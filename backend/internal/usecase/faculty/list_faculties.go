package faculty

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
	"cmu-review-backend/internal/domain/repository"
)

type ListFacultiesUseCase struct {
	faculties repository.FacultyRepository
}

func NewListFaculties(faculties repository.FacultyRepository) *ListFacultiesUseCase {
	return &ListFacultiesUseCase{faculties: faculties}
}

func (uc *ListFacultiesUseCase) Execute(ctx context.Context) ([]entity.Faculty, error) {
	return uc.faculties.ListAll(ctx)
}
