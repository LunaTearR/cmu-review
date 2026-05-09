package review

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
)

type CreateReviewUseCase struct {
	reviews repository.ReviewRepository
	courses repository.CourseRepository
	spam    port.SpamChecker
}

type CreateReviewInput struct {
	CourseID      int
	Actor         port.Actor
	Rating        uint8
	Grade         string
	AcademicYear  int
	Semester      int
	Content       string
	HoneypotValue string
}

func NewCreateReview(
	reviews repository.ReviewRepository,
	courses repository.CourseRepository,
	spam port.SpamChecker,
) *CreateReviewUseCase {
	return &CreateReviewUseCase{reviews: reviews, courses: courses, spam: spam}
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
		IPHash:       in.Actor.SubmitterHash(),
	}

	return uc.reviews.Create(ctx, r)
}
