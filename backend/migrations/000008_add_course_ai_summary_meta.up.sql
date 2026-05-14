ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS ai_summary_review_count   INT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary_last_review_id BIGINT NOT NULL DEFAULT 0;
