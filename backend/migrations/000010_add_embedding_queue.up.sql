-- Per-course debounce queue for the embedding worker.
-- PRIMARY KEY on course_id lets enqueue use ON CONFLICT DO NOTHING so a
-- burst of N reviews for the same course collapses to one row.
CREATE TABLE IF NOT EXISTS embedding_queue (
    course_id  INT         PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worker claims oldest-first; index keeps that scan cheap.
CREATE INDEX IF NOT EXISTS embedding_queue_created_at_idx
    ON embedding_queue (created_at);
