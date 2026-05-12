package course

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/search"
)

type ListCoursesInput struct {
	Search    string
	Faculties []string
	Credits   int
	Category  string
	SortBy    string
	Page      int
	Limit     int
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

	in.Search = search.Sanitize(in.Search)

	return uc.repo.List(ctx, repository.CourseListOpts{
		Search:    in.Search,
		Faculties: in.Faculties,
		Credits:   in.Credits,
		Category:  in.Category,
		SortBy:    in.SortBy,
		Limit:     in.Limit,
		Offset:    (in.Page - 1) * in.Limit,
	})
}
