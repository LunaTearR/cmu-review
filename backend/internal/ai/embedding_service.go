package ai

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"cmu-review-backend/internal/usecase/port"
)

// EmbeddingService is a cost-reducing wrapper around port.EmbeddingGenerator.
//
// Lookup order (cheapest first):
//
//	L1  process-local LRU            ~ns      free
//	L2  shared Redis cache           ~ms      free per hit, $0 to upstream
//	L3  upstream embed model         ~100ms   PAID per call
//
// Why this is the right shape for cost:
//   - Hot queries ("ตัวฟรี ภาคปกติ", "calculus", "เลือกเสรี") cost ONE
//     embed call across the whole fleet, not one per pod per request.
//   - Static content (course / review text) is embedded by the offline
//     worker and persisted to the reviews.embedding BYTEA column — it
//     MUST NOT pass through this service. EmbeddingService is for QUERY
//     embeddings only.
//   - The canonical key uses QueryPreprocessor output, so cosmetic
//     differences ("ตัวฟรี!!", "ตัวฟรี") collide on one cache row.
//
// Implements port.EmbeddingGenerator so it can be dropped in wherever the
// raw client is wired today.
type EmbeddingService struct {
	upstream port.EmbeddingGenerator
	cache    port.Cache // optional; nil → skip L2
	mem      *lruCache
	pre      *QueryPreprocessor
	ttl      time.Duration
	prefix   string
}

// EmbeddingServiceConfig groups the knobs main.go has to set. Defaults
// chosen so the zero-config call still works (in-mem cache, 30-day TTL).
type EmbeddingServiceConfig struct {
	Upstream     port.EmbeddingGenerator
	SharedCache  port.Cache // pass the Redis adapter, or nil
	Preprocessor *QueryPreprocessor
	TTL          time.Duration
	MemCapacity  int
	KeyPrefix    string // e.g. "emb:q:" — namespaces the Redis keys
}

func NewEmbeddingService(cfg EmbeddingServiceConfig) *EmbeddingService {
	if cfg.Preprocessor == nil {
		cfg.Preprocessor = NewQueryPreprocessor()
	}
	if cfg.TTL <= 0 {
		// 30 days is safe because the embed model + dimension are
		// pinned in main.go. When either changes we bump KeyPrefix.
		cfg.TTL = 30 * 24 * time.Hour
	}
	if cfg.MemCapacity <= 0 {
		cfg.MemCapacity = 1024
	}
	if cfg.KeyPrefix == "" {
		cfg.KeyPrefix = "emb:q:"
	}
	return &EmbeddingService{
		upstream: cfg.Upstream,
		cache:    cfg.SharedCache,
		pre:      cfg.Preprocessor,
		mem:      newLRU(cfg.MemCapacity),
		ttl:      cfg.TTL,
		prefix:   cfg.KeyPrefix,
	}
}

var _ port.EmbeddingGenerator = (*EmbeddingService)(nil)

// Generate returns the embedding for `text`. The flow is fail-open: a
// Redis outage degrades us to L1 + upstream; an upstream outage returns
// the error to the caller (we don't fabricate vectors).
func (s *EmbeddingService) Generate(ctx context.Context, text string) ([]float32, error) {
	if s.upstream == nil {
		return nil, errors.New("embedding-service: no upstream configured")
	}
	clean := s.pre.Normalize(text)
	if clean == "" {
		return nil, errors.New("embedding-service: empty text after normalize")
	}
	key := s.keyFor(clean)

	// L1: in-process LRU. Zero-allocation hit on the steady state.
	if vec, ok := s.mem.get(key); ok {
		return vec, nil
	}

	// L2: shared Redis. The decode is cheap relative to a network embed
	// call (which is the worst case we're avoiding).
	if s.cache != nil {
		if raw, err := s.cache.Get(ctx, key); err == nil {
			if vec, decErr := decodeVec(raw); decErr == nil && len(vec) > 0 {
				s.mem.set(key, vec)
				return vec, nil
			}
		}
	}

	// L3: paid upstream call. Only path that costs money.
	vec, err := s.upstream.Generate(ctx, clean)
	if err != nil {
		return nil, err
	}
	s.mem.set(key, vec)
	if s.cache != nil {
		if raw, encErr := encodeVec(vec); encErr == nil {
			// Best-effort write; do NOT fail the caller on cache write.
			_ = s.cache.Set(ctx, key, raw, s.ttl)
		}
	}
	return vec, nil
}

// keyFor produces a stable Redis key for the canonical text. Hashing keeps
// keys short and binary-safe regardless of the input alphabet.
func (s *EmbeddingService) keyFor(clean string) string {
	sum := sha256.Sum256([]byte(clean))
	return s.prefix + hex.EncodeToString(sum[:16])
}

// encodeVec / decodeVec use a compact binary form (4 bytes per float32)
// instead of JSON. For a 768-dim vector that's 3 KiB vs ~12 KiB encoded —
// matters at scale because Redis bandwidth is the next bottleneck once
// upstream calls collapse.
func encodeVec(v []float32) ([]byte, error) {
	if len(v) == 0 {
		return nil, errors.New("encode: empty vector")
	}
	buf := make([]byte, 4+4*len(v))
	binary.BigEndian.PutUint32(buf[:4], uint32(len(v)))
	for i, f := range v {
		binary.BigEndian.PutUint32(buf[4+i*4:8+i*4], math.Float32bits(f))
	}
	return buf, nil
}

func decodeVec(buf []byte) ([]float32, error) {
	if len(buf) < 4 {
		// Tolerate legacy JSON-encoded entries: try JSON first, fall back
		// to error. Keeps cold cache working even if format ever changes.
		var v []float32
		if err := json.Unmarshal(buf, &v); err == nil && len(v) > 0 {
			return v, nil
		}
		return nil, fmt.Errorf("decode: short buffer (%d)", len(buf))
	}
	n := binary.BigEndian.Uint32(buf[:4])
	if int(n)*4+4 != len(buf) {
		// length mismatch usually means JSON; try and fall through.
		var v []float32
		if err := json.Unmarshal(buf, &v); err == nil && len(v) > 0 {
			return v, nil
		}
		return nil, fmt.Errorf("decode: length mismatch")
	}
	out := make([]float32, n)
	for i := uint32(0); i < n; i++ {
		out[i] = math.Float32frombits(binary.BigEndian.Uint32(buf[4+i*4 : 8+i*4]))
	}
	return out, nil
}

// --- lruCache: tiny mutex-guarded LRU keyed by string. Plenty fast for
// the workload (one query embedding per HTTP request). Keeping it private
// to this file removes a third-party dep.

type lruNode struct {
	key  string
	vec  []float32
	prev *lruNode
	next *lruNode
}

type lruCache struct {
	mu    sync.Mutex
	cap   int
	items map[string]*lruNode
	head  *lruNode // most recently used
	tail  *lruNode // least recently used
}

func newLRU(capacity int) *lruCache {
	return &lruCache{cap: capacity, items: make(map[string]*lruNode, capacity)}
}

func (c *lruCache) get(k string) ([]float32, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	n, ok := c.items[k]
	if !ok {
		return nil, false
	}
	c.moveFront(n)
	return n.vec, true
}

func (c *lruCache) set(k string, v []float32) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if n, ok := c.items[k]; ok {
		n.vec = v
		c.moveFront(n)
		return
	}
	n := &lruNode{key: k, vec: v}
	c.items[k] = n
	c.pushFront(n)
	if len(c.items) > c.cap {
		c.evictTail()
	}
}

func (c *lruCache) pushFront(n *lruNode) {
	n.prev = nil
	n.next = c.head
	if c.head != nil {
		c.head.prev = n
	}
	c.head = n
	if c.tail == nil {
		c.tail = n
	}
}

func (c *lruCache) moveFront(n *lruNode) {
	if n == c.head {
		return
	}
	if n.prev != nil {
		n.prev.next = n.next
	}
	if n.next != nil {
		n.next.prev = n.prev
	}
	if n == c.tail {
		c.tail = n.prev
	}
	n.prev = nil
	n.next = c.head
	if c.head != nil {
		c.head.prev = n
	}
	c.head = n
}

func (c *lruCache) evictTail() {
	if c.tail == nil {
		return
	}
	old := c.tail
	if old.prev != nil {
		old.prev.next = nil
	}
	c.tail = old.prev
	if c.tail == nil {
		c.head = nil
	}
	delete(c.items, old.key)
}
