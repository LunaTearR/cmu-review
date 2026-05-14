package course

import (
	"context"
	"fmt"
	"strings"
	"unicode"

	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
)

// Threshold + batch constants for the AI-summary trigger.
// Caller (CreateReview) owns the decision; these are exported so the caller
// and the use case agree on the same numbers without hard-coding magic values.
const (
	// MinReviewsForSummary — first summary appears at this many visible reviews.
	MinReviewsForSummary = 5
	// SummaryRegenInterval — after the first summary, regen every N additional reviews.
	SummaryRegenInterval = 5
	// MaxReviewsInPrompt — cap reviews fed to the LLM (controls cost / token budget).
	MaxReviewsInPrompt = 50
	// MaxCharsPerReview — smart-trim each review to this many runes.
	MaxCharsPerReview = 400
)

// promptTemplate — Thai instruction sent to Gemini.
const promptTemplate = `สรุปความคิดเห็นของนักศึกษาที่เรียนวิชานี้จากรีวิวทั้งหมด
ให้สรุปเป็นภาพรวมจุดเด่น จุดที่ควรระวัง และลักษณะการเรียนการสอน
ตอบเป็นภาษาไทย อ่านง่าย ไม่เกิน 6 บรรทัด

รีวิวจากนักศึกษา:
%s`

type GenerateReviewSummaryUseCase struct {
	reviews   repository.ReviewRepository
	courses   repository.CourseRepository
	generator port.SummaryGenerator
}

func NewGenerateReviewSummary(
	reviews repository.ReviewRepository,
	courses repository.CourseRepository,
	generator port.SummaryGenerator,
) *GenerateReviewSummaryUseCase {
	return &GenerateReviewSummaryUseCase{
		reviews:   reviews,
		courses:   courses,
		generator: generator,
	}
}

// Execute pulls the latest reviews for a course, calls the LLM, and persists
// the result along with metadata used for the next-trigger decision.
// Returns (summary, true, nil) on success.
// Returns ("", false, nil) when there is nothing to summarize or the generator
// is disabled — caller treats these as no-ops, not errors.
//
// This method does NOT perform the "should we run?" check — that is the
// caller's job (see review.CreateReviewUseCase). Generate is pure: given a
// courseID, it always tries to produce a fresh summary.
func (uc *GenerateReviewSummaryUseCase) Execute(ctx context.Context, courseID int) (string, bool, error) {
	if uc.generator == nil {
		return "", false, nil // generator disabled (no API key) — silently skip
	}

	items, err := uc.reviews.ListLatestForSummary(ctx, courseID, MaxReviewsInPrompt)
	if err != nil {
		return "", false, fmt.Errorf("list review content: %w", err)
	}
	if len(items) == 0 {
		return "", false, nil
	}

	// Count of visible reviews — persisted so the next regen-trigger can compare
	// against it. Computed via the same source of truth used to build the prompt.
	totalCount, err := uc.reviews.CountVisibleByCourse(ctx, courseID)
	if err != nil {
		return "", false, fmt.Errorf("count reviews: %w", err)
	}

	prompt, lastReviewID := buildPrompt(items)
	summary, err := uc.generator.Generate(ctx, prompt)
	if err != nil {
		return "", false, fmt.Errorf("generate: %w", err)
	}

	summary = strings.TrimSpace(summary)
	if summary == "" {
		return "", false, nil
	}

	if err := uc.courses.UpdateAISummary(ctx, courseID, summary, totalCount, lastReviewID); err != nil {
		return "", false, fmt.Errorf("update ai_summary: %w", err)
	}
	return summary, true, nil
}

// buildPrompt smart-trims each review and concatenates them into the final
// prompt string. Returns the prompt plus the largest review ID seen, which the
// caller persists into courses.ai_summary_last_review_id.
func buildPrompt(items []repository.ReviewContent) (string, int64) {
	var b strings.Builder
	var maxID int64
	idx := 0
	for _, it := range items {
		if it.ID > maxID {
			maxID = it.ID
		}
		trimmed := smartTrim(it.Content, MaxCharsPerReview)
		if trimmed == "" {
			continue
		}
		idx++
		fmt.Fprintf(&b, "%d. %s\n", idx, trimmed)
	}
	return fmt.Sprintf(promptTemplate, b.String()), maxID
}

// smartTrim normalizes whitespace and caps the rune length while trying to
// preserve sentence boundaries.
//
// Steps:
//  1. Replace any whitespace run with a single space.
//  2. Trim leading/trailing space.
//  3. If the result is within the rune limit, return as-is.
//  4. Otherwise truncate at the limit and back up to the last sentence-end
//     punctuation in the trailing window, so we don't cut mid-clause.
//  5. Append an ellipsis to signal truncation to the LLM.
func smartTrim(s string, maxRunes int) string {
	s = collapseWhitespace(s)
	if s == "" {
		return ""
	}

	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}

	cut := runes[:maxRunes]
	// Back up to the last sentence terminator inside the trailing 20% window
	// so we don't cut a clause in half. Window keeps us from losing too much.
	window := maxRunes / 5
	if window < 30 {
		window = 30
	}
	terminators := map[rune]bool{
		'.': true, '!': true, '?': true,
		'。': true, // CJK '。'
		'！': true, // CJK fullwidth '!'
		'？': true, // CJK fullwidth '?'
		'\n':     true,
	}
	best := -1
	for i := len(cut) - 1; i >= len(cut)-window && i >= 0; i-- {
		if terminators[cut[i]] {
			best = i + 1
			break
		}
	}
	if best > 0 {
		cut = cut[:best]
	}
	out := strings.TrimSpace(string(cut))
	if out == "" {
		return ""
	}
	return out + "…"
}

func collapseWhitespace(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	prevSpace := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			if !prevSpace {
				b.WriteRune(' ')
				prevSpace = true
			}
			continue
		}
		b.WriteRune(r)
		prevSpace = false
	}
	return strings.TrimSpace(b.String())
}
