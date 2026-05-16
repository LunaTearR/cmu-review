package postgres

import (
	"context"
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/lib/pq"

	"cmu-review-backend/internal/domain/repository"
)

// Plain-Postgres embedding store. No pgvector dependency.
//
// Wire format on disk (column type BYTEA):
//   [0..4)   uint32 big-endian length N (number of float32s)
//   [4..4+4N) N consecutive big-endian IEEE-754 float32 values
//
// Same format used by the in-process query cache in package ai, so an
// embedded review row could be substituted for a cache entry byte-for-byte.
// Dimensionality is dictated by the Gemini model — currently 768.
//
// Similarity search:
//   1. SQL filters the candidate set (visibility + tags + categories).
//   2. We decode each BYTEA row and compute cosine in Go.
//   3. Sort by similarity desc, return top-K.
// At current corpus size (< 50k reviews) this is well under 100ms.
// Above that, switch to pgvector or external ANN.

type reviewEmbeddingPgRepo struct {
	db *sql.DB
}

func NewReviewEmbeddingRepo(db *sql.DB) repository.ReviewEmbeddingRepository {
	return &reviewEmbeddingPgRepo{db: db}
}

// candidateCap bounds the candidate set pulled from SQL so a degenerate
// query (no filters, full table) can't OOM the process. 10k rows × 768
// floats × 4 B ≈ 30 MB transfer worst case.
const candidateCap = 10000

// encodeFloat32Slice packs a float32 slice into the BYTEA wire format.
func encodeFloat32Slice(v []float32) ([]byte, error) {
	if len(v) == 0 {
		return nil, errors.New("review_embedding: empty vector")
	}
	buf := make([]byte, 4+4*len(v))
	binary.BigEndian.PutUint32(buf[:4], uint32(len(v)))
	for i, f := range v {
		binary.BigEndian.PutUint32(buf[4+i*4:8+i*4], math.Float32bits(f))
	}
	return buf, nil
}

// decodeFloat32Slice reverses encodeFloat32Slice. Returns nil + error on
// any mismatch so a corrupt row can be skipped rather than crash the
// search loop.
func decodeFloat32Slice(buf []byte) ([]float32, error) {
	if len(buf) < 4 {
		return nil, fmt.Errorf("review_embedding: decode: short buffer (%d)", len(buf))
	}
	n := binary.BigEndian.Uint32(buf[:4])
	if int(n)*4+4 != len(buf) {
		return nil, fmt.Errorf("review_embedding: decode: length mismatch (n=%d, buf=%d)", n, len(buf))
	}
	out := make([]float32, n)
	for i := uint32(0); i < n; i++ {
		out[i] = math.Float32frombits(binary.BigEndian.Uint32(buf[4+i*4 : 8+i*4]))
	}
	return out, nil
}

// cosineSimilarity returns the cosine of the angle between two equal-length
// vectors. Range [-1, 1]. Higher is more similar. Mismatched lengths or
// zero-magnitude vectors return 0 — never panics.
func cosineSimilarity(a, b []float32) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		af := float64(a[i])
		bf := float64(b[i])
		dot += af * bf
		na += af * af
		nb += bf * bf
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

func (r *reviewEmbeddingPgRepo) UpdateEmbedding(ctx context.Context, reviewID int64, vec []float32) error {
	buf, err := encodeFloat32Slice(vec)
	if err != nil {
		return err
	}
	const q = `UPDATE reviews SET embedding = $1 WHERE id = $2`
	_, err = r.db.ExecContext(ctx, q, buf, reviewID)
	return err
}

func (r *reviewEmbeddingPgRepo) SearchSimilar(
	ctx context.Context,
	vec []float32,
	limit int,
	requiredTags []string,
	requiredCategories []string,
) ([]repository.ReviewMatch, error) {
	if len(vec) == 0 {
		return nil, fmt.Errorf("review_embedding: empty query vector")
	}
	if limit <= 0 {
		limit = 50
	}

	// SQL prefilter: visibility + optional tags / categories. We pull a
	// bounded candidate window ordered by id DESC (newest first — best
	// proxy for relevance recency when no other ordering exists).
	var (
		where = []string{
			"embedding IS NOT NULL",
			"is_hidden = FALSE",
		}
		args = []any{candidateCap}
	)
	if len(requiredTags) > 0 {
		args = append(args, pq.Array(requiredTags))
		where = append(where, fmt.Sprintf("insight_tags && $%d::text[]", len(args)))
	}
	if len(requiredCategories) > 0 {
		args = append(args, pq.Array(requiredCategories))
		where = append(where, fmt.Sprintf("category = ANY($%d::text[])", len(args)))
	}

	q := `
		SELECT id, course_id, content, embedding
		FROM reviews
		WHERE ` + strings.Join(where, "\n\t\t  AND ") + `
		ORDER BY id DESC
		LIMIT $1`

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Score every candidate in Go. Heap would be a micro-optimization;
	// at <10k candidates a full sort is simpler and the dominant cost
	// is the cosine inner loop, not the sort.
	out := make([]repository.ReviewMatch, 0, 256)
	for rows.Next() {
		var (
			m   repository.ReviewMatch
			buf []byte
		)
		if err := rows.Scan(&m.ReviewID, &m.CourseID, &m.Content, &buf); err != nil {
			return nil, err
		}
		other, decErr := decodeFloat32Slice(buf)
		if decErr != nil || len(other) == 0 {
			continue
		}
		m.Similarity = cosineSimilarity(vec, other)
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Similarity > out[j].Similarity
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (r *reviewEmbeddingPgRepo) ListMissingEmbedding(ctx context.Context, limit int) ([]repository.ReviewContent, error) {
	if limit <= 0 {
		limit = 200
	}
	const q = `
		SELECT id, content
		FROM reviews
		WHERE embedding IS NULL
		  AND content <> ''
		ORDER BY id ASC
		LIMIT $1`
	rows, err := r.db.QueryContext(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []repository.ReviewContent
	for rows.Next() {
		var rc repository.ReviewContent
		if err := rows.Scan(&rc.ID, &rc.Content); err != nil {
			return nil, err
		}
		out = append(out, rc)
	}
	return out, rows.Err()
}

// ListMissingEmbedSourcesByCourse returns reviews of a SINGLE course that
// still lack an embedding. Used by the worker after ClaimBatch hands it a
// courseID — the worker then loops over the returned rows and embeds each.
func (r *reviewEmbeddingPgRepo) ListMissingEmbedSourcesByCourse(ctx context.Context, courseID, limit int) ([]repository.ReviewEmbedSource, error) {
	if limit <= 0 {
		limit = 200
	}
	const q = `
		SELECT r.id, r.course_id, r.content, r.insight_tags,
		       c.name_th, c.name_en
		FROM reviews r
		JOIN courses c ON c.id = r.course_id
		WHERE r.embedding IS NULL
		  AND r.content <> ''
		  AND r.is_hidden = FALSE
		  AND r.course_id = $1
		ORDER BY r.id ASC
		LIMIT $2`
	rows, err := r.db.QueryContext(ctx, q, courseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []repository.ReviewEmbedSource
	for rows.Next() {
		var s repository.ReviewEmbedSource
		if err := rows.Scan(&s.ID, &s.CourseID, &s.Content, pq.Array(&s.Tags), &s.CourseNameTH, &s.CourseNameEN); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ListMissingEmbedSources returns reviews lacking an embedding, joined with
// course name fields so the caller can compose the full embedding text
// (review content + tags + course names).
func (r *reviewEmbeddingPgRepo) ListMissingEmbedSources(ctx context.Context, limit int) ([]repository.ReviewEmbedSource, error) {
	if limit <= 0 {
		limit = 200
	}
	const q = `
		SELECT r.id, r.course_id, r.content, r.insight_tags,
		       c.name_th, c.name_en
		FROM reviews r
		JOIN courses c ON c.id = r.course_id
		WHERE r.embedding IS NULL
		  AND r.content <> ''
		  AND r.is_hidden = FALSE
		ORDER BY r.id ASC
		LIMIT $1`
	rows, err := r.db.QueryContext(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []repository.ReviewEmbedSource
	for rows.Next() {
		var s repository.ReviewEmbedSource
		if err := rows.Scan(&s.ID, &s.CourseID, &s.Content, pq.Array(&s.Tags), &s.CourseNameTH, &s.CourseNameEN); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
