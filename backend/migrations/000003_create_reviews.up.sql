CREATE TABLE IF NOT EXISTS reviews (
    id             SERIAL PRIMARY KEY,
    course_id      INTEGER      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id        INTEGER      NULL,
    rating         SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    grade          VARCHAR(2)   NULL,
    academic_year  SMALLINT     NOT NULL,
    semester       SMALLINT     NOT NULL CHECK (semester IN (1, 2, 3)),
    content        TEXT         NOT NULL,
    ip_hash        VARCHAR(64)  NOT NULL,
    is_hidden      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_course_id  ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_ip_hash    ON reviews(ip_hash);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_dedup
    ON reviews(course_id, ip_hash, academic_year, semester);

CREATE VIEW course_stats AS
SELECT
    course_id,
    COUNT(*)                        AS review_count,
    ROUND(AVG(rating)::NUMERIC, 2)  AS avg_rating
FROM reviews
WHERE is_hidden = FALSE
GROUP BY course_id;
