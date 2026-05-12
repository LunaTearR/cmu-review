package course

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
)

type CreateCourseInput struct {
	CourseCode   string
	NameTH       string
	NameEN       string
	Credits      uint8
	FacultyID    int
	Description  string
	Prerequisite string
}

type CreateCourseUseCase struct {
	repo repository.CourseRepository
}

func NewCreateCourse(repo repository.CourseRepository) *CreateCourseUseCase {
	return &CreateCourseUseCase{repo: repo}
}

func (uc *CreateCourseUseCase) Execute(ctx context.Context, in CreateCourseInput) (*entity.Course, error) {
	return uc.repo.Create(ctx, &entity.Course{
		CourseCode:   in.CourseCode,
		NameTH:       in.NameTH,
		NameEN:       in.NameEN,
		Credits:      in.Credits,
		FacultyID:    in.FacultyID,
		Description:  in.Description,
		Prerequisite: in.Prerequisite,
	})
}
