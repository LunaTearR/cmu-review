ALTER TABLE courses
  DROP COLUMN IF EXISTS ai_summary_review_count,
  DROP COLUMN IF EXISTS ai_summary_last_review_id;
