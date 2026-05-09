package course

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
)

type GetCourseUseCase struct {
	repo repository.CourseRepository
}

func NewGetCourse(repo repository.CourseRepository) *GetCourseUseCase {
	return &GetCourseUseCase{repo: repo}
}

func (uc *GetCourseUseCase) Execute(ctx context.Context, id int) (*entity.Course, error) {
	return uc.repo.GetByID(ctx, id)
}
