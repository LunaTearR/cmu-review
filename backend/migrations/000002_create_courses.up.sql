CREATE TABLE IF NOT EXISTS courses (
    id          SERIAL PRIMARY KEY,
    course_id   VARCHAR(20)  NOT NULL UNIQUE,
    name_th     VARCHAR(255) NOT NULL,
    name_en     VARCHAR(255) NOT NULL,
    credits     SMALLINT     NOT NULL,
    faculty_id  INTEGER      NOT NULL REFERENCES faculties(id) ON DELETE RESTRICT,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_faculty_id  ON courses(faculty_id);
CREATE INDEX IF NOT EXISTS idx_courses_course_id   ON courses(course_id);
CREATE INDEX IF NOT EXISTS idx_courses_name_search ON courses USING GIN (
    to_tsvector('simple', name_th || ' ' || name_en || ' ' || course_id)
);
