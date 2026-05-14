package port

import "context"

// SummaryGenerator produces an AI-generated summary from a prompt.
// Implementations call an external LLM (e.g. Gemini) and return the plain-text result.
type SummaryGenerator interface {
	Generate(ctx context.Context, prompt string) (string, error)
}
