// Package intent loads a Thai-query → DB-filter mapping from a JSON file
// and exposes it via the port.IntentDetector interface. The two-layer
// design (phrases → property assignments, properties → DB filters) lets
// product edit vocabulary without touching DB strings, and engineering
// change DB filters without touching vocabulary.
//
// File format:
//
//	{
//	  "phrases": [
//	    { "match": "ตัวฟรี", "assign": { "isFree": "true" } }
//	  ],
//	  "properties": {
//	    "isFree": {
//	      "true": { "categories": ["หมวดวิชาฟรี"] }
//	    },
//	    "workload": {
//	      "low":  { "tags": ["งานน้อย ทำสบาย"] },
//	      "high": { "tags": ["งานค่อนข้างเยอะ"] }
//	    }
//	  }
//	}
//
// Detect:
//   - case-sensitive substring match on `phrases[].match`
//   - every matching phrase contributes its `assign` map
//   - each (property, value) pair is resolved in `properties` to a filter
//   - all filters unioned + deduped into the returned IntentFilter
//
// Missing or empty file => no-op detector (semantic search degrades to
// pure cosine with no strict filter).
package intent

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"cmu-review-backend/internal/usecase/port"
)

type phraseEntry struct {
	Match  string            `json:"match"`
	Assign map[string]string `json:"assign"`
}

type filterValues struct {
	Tags       []string `json:"tags,omitempty"`
	Categories []string `json:"categories,omitempty"`
	// Programs match reviews.program (e.g. "ภาคพิเศษ", "นานาชาติ").
	// Field added so the JSON `programs: [...]` entries stop being
	// silently dropped by encoding/json.
	Programs []string `json:"programs,omitempty"`
}

type fileConfig struct {
	Phrases    []phraseEntry                      `json:"phrases"`
	Properties map[string]map[string]filterValues `json:"properties"`
}

// JSONMapper holds parsed intent configuration. Zero value (no phrases,
// no properties) is a safe no-op detector.
type JSONMapper struct {
	cfg   fileConfig
	trie  *phraseTrie // built from cfg.Phrases at load time
}

var _ port.IntentDetector = (*JSONMapper)(nil)

// LoadFromFile reads and parses an intent config JSON file. Returns a
// usable no-op mapper (not an error) when the file does not exist, so a
// missing config never crashes startup — semantic search still works,
// just without intent-driven filtering.
func LoadFromFile(path string) (*JSONMapper, error) {
	if path == "" {
		return &JSONMapper{}, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &JSONMapper{}, nil
		}
		return nil, fmt.Errorf("intent: read %s: %w", path, err)
	}
	var c fileConfig
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("intent: parse %s: %w", path, err)
	}
	return &JSONMapper{cfg: c, trie: buildPhraseTrie(c.Phrases)}, nil
}

// PhraseCount reports how many phrase rules are loaded — useful for a
// boot-time log line so ops can spot a silently-empty config.
func (m *JSONMapper) PhraseCount() int {
	if m == nil {
		return 0
	}
	return len(m.cfg.Phrases)
}

// Detect implements port.IntentDetector.
//
// Extraction strategy: one left-to-right pass over the query through a
// pre-built phrase trie. The trie emits all non-overlapping LONGEST
// matches in input order, so a no-space multi-intent query like
// "ตัวgeภาคพิเศษเก็บaง่าย" yields every configured phrase it contains
// in a single O(N) scan — replaces the previous O(N × phrases)
// Contains loop.
//
// Matching is case-insensitive: the trie was built from lowered phrase
// keys (see buildPhraseTrie), and the query is lowered here. Thai runes
// are unaffected by case folding; the lowering only normalizes ASCII
// (e.g. "GE" / "ge" / "Ge" all collide on the same trie path).
func (m *JSONMapper) Detect(query string) port.IntentFilter {
	if m == nil {
		return port.IntentFilter{}
	}
	q := strings.TrimSpace(query)
	if q == "" || m.trie == nil {
		return port.IntentFilter{}
	}
	qLower := strings.ToLower(q)

	var (
		tags  []string
		cats  []string
		progs []string
		tSeen = make(map[string]struct{})
		cSeen = make(map[string]struct{})
		pSeen = make(map[string]struct{})
	)
	appendUnique := func(in []string, seen map[string]struct{}, dst *[]string) {
		for _, v := range in {
			v = strings.TrimSpace(v)
			if v == "" {
				continue
			}
			if _, dup := seen[v]; dup {
				continue
			}
			seen[v] = struct{}{}
			*dst = append(*dst, v)
		}
	}

	// scanAll returns one assign block per matched phrase, in input
	// order. Same assign keys across hits naturally union via the
	// dedupe step below.
	for _, assign := range m.trie.scanAll(qLower) {
		for propName, propValue := range assign {
			byValue, ok := m.cfg.Properties[propName]
			if !ok {
				continue
			}
			f, ok := byValue[propValue]
			if !ok {
				continue
			}
			appendUnique(f.Tags, tSeen, &tags)
			appendUnique(f.Categories, cSeen, &cats)
			appendUnique(f.Programs, pSeen, &progs)
		}
	}
	return port.IntentFilter{Tags: tags, Categories: cats, Programs: progs}
}
