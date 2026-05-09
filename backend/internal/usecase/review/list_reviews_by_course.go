package review

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
)

type ListReviewsByCourseUseCase struct {
	reviews repository.ReviewRepository
}

type ListReviewsInput struct {
	CourseID int
	Page     int
	Limit    int
}

func NewListReviewsByCourse(reviews repository.ReviewRepository) *ListReviewsByCourseUseCase {
	return &ListReviewsByCourseUseCase{reviews: reviews}
}

func (uc *ListReviewsByCourseUseCase) Execute(ctx context.Context, in ListReviewsInput) ([]entity.Review, int, error) {
	if in.Page < 1 {
		in.Page = 1
	}
	if in.Limit <= 0 || in.Limit > 100 {
		in.Limit = 20
	}
	return uc.reviews.ListByCourse(ctx, in.CourseID, repository.ListOpts{
		Limit:  in.Limit,
		Offset: (in.Page - 1) * in.Limit,
	})
}
