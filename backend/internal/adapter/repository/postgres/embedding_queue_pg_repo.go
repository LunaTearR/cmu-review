package postgres

import (
	"context"
	"database/sql"

	"cmu-review-backend/internal/domain/repository"
)

type embeddingQueuePgRepo struct {
	db *sql.DB
}

func NewEmbeddingQueueRepo(db *sql.DB) repository.EmbeddingQueueRepository {
	return &embeddingQueuePgRepo{db: db}
}

// Enqueue uses ON CONFLICT DO NOTHING against the PRIMARY KEY so concurrent
// inserts for the same course coalesce into a single queued row.
// Wall-clock cost: < 1ms in steady state.
func (r *embeddingQueuePgRepo) Enqueue(ctx context.Context, courseID int) error {
	const q = `
		INSERT INTO embedding_queue (course_id)
		VALUES ($1)
		ON CONFLICT (course_id) DO NOTHING`
	_, err := r.db.ExecContext(ctx, q, courseID)
	return err
}

// ClaimBatch atomically takes ownership of up to `limit` queued rows.
//
// Why this query is race-free across workers:
//   - The CTE selects rows with FOR UPDATE SKIP LOCKED. Postgres takes a
//     row-level write lock on each scanned row that is NOT already locked
//     by another transaction; locked rows are silently skipped. Two
//     concurrent workers therefore receive disjoint sets.
//   - The outer DELETE … RETURNING removes the claimed rows in the same
//     statement / implicit transaction, so the rows are no longer visible
//     to any other ClaimBatch the moment this statement returns.
//   - No long-held transaction: the entire claim is one Exec/Query call.
//     The DB locks are released as soon as the statement ends.
//
// We deliberately delete BEFORE the embed work happens (rather than after)
// so a worker crash cannot leave an "in flight" row stuck in the queue
// forever. At-most-once is acceptable here because (a) embed writes are
// idempotent and (b) the backfill CLI is a reliable recovery sweep.
func (r *embeddingQueuePgRepo) ClaimBatch(ctx context.Context, limit int) ([]int, error) {
	if limit <= 0 {
		limit = 50
	}
	const q = `
		WITH claimed AS (
			SELECT course_id
			FROM embedding_queue
			ORDER BY created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		DELETE FROM embedding_queue
		WHERE course_id IN (SELECT course_id FROM claimed)
		RETURNING course_id`

	rows, err := r.db.QueryContext(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]int, 0, limit)
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
