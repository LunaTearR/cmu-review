package course

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
)

type ListCoursesInput struct {
	Search  string
	Faculty string
	Credits int
	SortBy  string
	Page    int
	Limit   int
}

type ListCoursesUseCase struct {
	repo repository.CourseRepository
}

func NewListCourses(repo repository.CourseRepository) *ListCoursesUseCase {
	return &ListCoursesUseCase{repo: repo}
}

func (uc *ListCoursesUseCase) Execute(ctx context.Context, in ListCoursesInput) ([]entity.Course, int, error) {
	if in.Page < 1 {
		in.Page = 1
	}
	if in.Limit < 1 || in.Limit > 100 {
		in.Limit = 20
	}
	return uc.repo.List(ctx, repository.CourseListOpts{
		Search:  in.Search,
		Faculty: in.Faculty,
		Credits: in.Credits,
		SortBy:  in.SortBy,
		Limit:   in.Limit,
		Offset:  (in.Page - 1) * in.Limit,
	})
}
