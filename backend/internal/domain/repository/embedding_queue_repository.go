package repository

import "context"

// EmbeddingQueueRepository is the per-course debounce queue used by the
// embedding worker. Implementation is in
// internal/adapter/repository/postgres.
//
// Concurrency contract:
//   - Enqueue is safe to call from any number of goroutines / processes.
//     Duplicate course_ids are coalesced via ON CONFLICT DO NOTHING.
//   - ClaimBatch is safe to call from any number of worker instances.
//     Implementations MUST use FOR UPDATE SKIP LOCKED + DELETE so two
//     workers never receive the same course_id.
type EmbeddingQueueRepository interface {
	// Enqueue marks `courseID` as needing embedding refresh. No-op if the
	// course is already queued. Returns quickly (single INSERT).
	Enqueue(ctx context.Context, courseID int) error

	// ClaimBatch atomically removes up to `limit` oldest queued course_ids
	// and returns them. Returned IDs are owned by this caller and will
	// never be returned to another caller. If the caller crashes before
	// processing them, the rows ARE lost from the queue (at-most-once);
	// recovery relies on (a) the next review for that course re-enqueueing
	// and (b) the backfill CLI sweeping NULL embeddings.
	ClaimBatch(ctx context.Context, limit int) ([]int, error)
}
