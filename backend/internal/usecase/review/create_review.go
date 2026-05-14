package review

import (
	"context"
	"log"
	"strings"

	"cmu-review-backend/internal/domain/entity"
	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
)

// SummaryRegenerator is the narrow contract CreateReviewUseCase needs from the
// AI summary use case. Kept here so review depends only on a tiny interface,
// not on the course use case directly.
type SummaryRegenerator interface {
	Execute(ctx context.Context, courseID int) (string, bool, error)
}

// sanitizeTags trims, drops empties, and dedupes insight tag input.
// Returns []string{} (not nil) so the DB column receives '{}' not NULL.
func sanitizeTags(in []string) []string {
	out := make([]string, 0, len(in))
	seen := make(map[string]struct{}, len(in))
	for _, t := range in {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

type CreateReviewUseCase struct {
	reviews repository.ReviewRepository
	courses repository.CourseRepository
	spam    port.SpamChecker
	summary SummaryRegenerator // optional — nil if AI summary disabled
}

type CreateReviewInput struct {
	CourseID      int
	Actor         port.Actor
	Rating        uint8
	Grade         string
	AcademicYear  int
	Semester      int
	Content       string
	Category      string
	Program       string
	Professor     string
	ReviewerName  string
	InsightTags   []string
	HoneypotValue string
}

func NewCreateReview(
	reviews repository.ReviewRepository,
	courses repository.CourseRepository,
	spam port.SpamChecker,
) *CreateReviewUseCase {
	return &CreateReviewUseCase{reviews: reviews, courses: courses, spam: spam}
}

// WithSummaryRegenerator wires the AI summary use case so a review insert
// triggers regeneration when the course crosses the visibility threshold.
// Returns the receiver for chained construction in cmd/main.go.
func (uc *CreateReviewUseCase) WithSummaryRegenerator(s SummaryRegenerator) *CreateReviewUseCase {
	uc.summary = s
	return uc
}

func (uc *CreateReviewUseCase) Execute(ctx context.Context, in CreateReviewInput) (*entity.Review, error) {
	if err := uc.spam.Check(ctx, port.SpamInput{
		HoneypotValue: in.HoneypotValue,
		SubmitterHash: in.Actor.SubmitterHash(),
		CourseID:      in.CourseID,
		Content:       in.Content,
	}); err != nil {
		return nil, err
	}

	ok, err := uc.courses.Exists(ctx, in.CourseID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domainerrors.ErrCourseNotFound
	}

	if in.Rating < 1 || in.Rating > 5 {
		return nil, domainerrors.ErrInvalidRating
	}
	if in.Semester < 1 || in.Semester > 3 {
		return nil, domainerrors.ErrInvalidSemester
	}

	r := &entity.Review{
		CourseID:     in.CourseID,
		UserID:       in.Actor.UserID(),
		Rating:       in.Rating,
		Grade:        in.Grade,
		AcademicYear: in.AcademicYear,
		Semester:     in.Semester,
		Content:      in.Content,
		Category:     in.Category,
		Program:      in.Program,
		Professor:    in.Professor,
		ReviewerName: in.ReviewerName,
		InsightTags:  sanitizeTags(in.InsightTags),
		IPHash:       in.Actor.SubmitterHash(),
	}

	created, err := uc.reviews.Create(ctx, r)
	if err != nil {
		return nil, err
	}

	uc.maybeRegenerateSummary(created.CourseID)

	return created, nil
}

// summaryFirstThreshold / summaryStepInterval mirror the constants in
// course.GenerateReviewSummaryUseCase. Duplicated here as untyped consts
// instead of importing the course package, because review must not depend on
// other use case packages (peer layer rule).
const (
	summaryFirstThreshold = 5 // first summary fires at this many visible reviews
	summaryStepInterval   = 5 // subsequent regen every N more reviews
)

// maybeRegenerateSummary runs the AI-summary decision in a background
// goroutine. Detached from the request context (the request returns long
// before Gemini does) and survives a hot handler return.
//
// Rule (production-safe, robust against count jumps from concurrent inserts):
//
//	IF  course.ai_summary == ""  AND review_count >= summaryFirstThreshold
//	    → first-time generation
//	ELSE IF review_count >= ai_summary_review_count + summaryStepInterval
//	    → batched regeneration
//	ELSE
//	    → no-op (cost saver)
//
// We do NOT use `review_count == 5` because a 4→6 jump under concurrent
// inserts would silently miss the trigger.
func (uc *CreateReviewUseCase) maybeRegenerateSummary(courseID int) {
	if uc.summary == nil {
		return
	}
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("ai_summary: panic for course %d: %v", courseID, rec)
			}
		}()
		ctx := context.Background()

		count, err := uc.reviews.CountVisibleByCourse(ctx, courseID)
		if err != nil {
			log.Printf("ai_summary: course %d: count: %v", courseID, err)
			return
		}
		course, err := uc.courses.GetByID(ctx, courseID)
		if err != nil {
			log.Printf("ai_summary: course %d: load: %v", courseID, err)
			return
		}

		firstTime := course.AISummary == "" && count >= summaryFirstThreshold
		batched := count >= course.AISummaryReviewCount+summaryStepInterval
		if !firstTime && !batched {
			return
		}

		if _, _, err := uc.summary.Execute(ctx, courseID); err != nil {
			log.Printf("ai_summary: course %d: generate: %v", courseID, err)
		}
	}()
}
