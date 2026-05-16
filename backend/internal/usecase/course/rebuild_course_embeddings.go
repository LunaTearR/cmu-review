package course

import (
	"context"
	"fmt"
	"log"

	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
	"cmu-review-backend/internal/usecase/review"
)

// RebuildCourseEmbeddingsUseCase is the unit of work the embedding worker
// invokes after claiming a courseID from embedding_queue. It loads every
// review of that course whose `embedding` column is still NULL, generates
// a vector for each, and persists it.
//
// Idempotent and safe to call multiple times for the same courseID:
//   - Already-embedded reviews are skipped at the SQL level (WHERE embedding IS NULL).
//   - A partial run (e.g. ctx timeout midway) leaves the remainder for the
//     next queue claim or the backfill CLI to pick up.
//
// NOT goroutine-safe to call concurrently with the same courseID in two
// places — but the worker design prevents that: ClaimBatch hands a given
// courseID to exactly one caller.
type RebuildCourseEmbeddingsUseCase struct {
	embeds   repository.ReviewEmbeddingRepository
	embedder port.EmbeddingGenerator
	batch    int
}

func NewRebuildCourseEmbeddings(
	embeds repository.ReviewEmbeddingRepository,
	embedder port.EmbeddingGenerator,
) *RebuildCourseEmbeddingsUseCase {
	return &RebuildCourseEmbeddingsUseCase{
		embeds:   embeds,
		embedder: embedder,
		batch:    200,
	}
}

// Execute embeds all missing-vector reviews for `courseID`. Returns nil
// (no-op) when the embedder is unconfigured so the worker can run safely
// even before GEMINI_API_KEY is wired.
func (uc *RebuildCourseEmbeddingsUseCase) Execute(ctx context.Context, courseID int) error {
	if uc.embedder == nil {
		return nil
	}

	sources, err := uc.embeds.ListMissingEmbedSourcesByCourse(ctx, courseID, uc.batch)
	if err != nil {
		return fmt.Errorf("rebuild_course_embed: list course %d: %w", courseID, err)
	}
	if len(sources) == 0 {
		return nil
	}

	embedded := 0
	for _, src := range sources {
		// Honor cancellation between calls so a stuck Gemini RPC plus
		// stop signal can unwind in O(per-call timeout), not O(N * timeout).
		if err := ctx.Err(); err != nil {
			return err
		}

		text := review.ComposeReviewEmbedText(src.CourseNameTH, src.CourseNameEN, src.Content, src.Tags)
		if text == "" {
			continue
		}
		vec, err := uc.embedder.Generate(ctx, text)
		if err != nil {
			// Per-review failure is non-fatal: log and continue so a single
			// bad review doesn't poison the whole course batch. The NULL
			// row will be retried on the next enqueue / backfill.
			log.Printf("rebuild_course_embed: review %d: generate: %v", src.ID, err)
			continue
		}
		if err := uc.embeds.UpdateEmbedding(ctx, src.ID, vec); err != nil {
			log.Printf("rebuild_course_embed: review %d: persist: %v", src.ID, err)
			continue
		}
		embedded++
	}
	log.Printf("rebuild_course_embed: course %d: embedded %d/%d reviews", courseID, embedded, len(sources))
	return nil
}
