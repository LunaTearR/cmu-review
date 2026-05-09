CREATE TABLE IF NOT EXISTS faculties (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(20)  NOT NULL UNIQUE,
    name_th    VARCHAR(255) NOT NULL,
    name_en    VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculties_code ON faculties(code);
