-- Plain Postgres (no pgvector extension required). Railway managed
-- Postgres ships without `vector` so we store embeddings as BYTEA: a
-- packed 4-bytes-per-float32 buffer with a 4-byte big-endian length
-- prefix. Encoding / decoding lives in the Go repo layer.
--
-- Trade-off vs pgvector: no IVF / HNSW server-side index. Similarity
-- search filters candidates in SQL (visibility + tags + categories)
-- and ranks the remaining set with cosine computed in Go. Acceptable
-- for the current corpus size; revisit when reviews cross ~100k rows.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS embedding BYTEA;
