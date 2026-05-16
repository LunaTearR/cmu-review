package port

import "context"

// EmbeddingGenerator turns text into a fixed-dimension embedding vector.
// Implementations call an external model (e.g. Gemini text-embedding-004).
type EmbeddingGenerator interface {
	Generate(ctx context.Context, text string) ([]float32, error)
}
