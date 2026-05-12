package review

import (
	"context"

	"cmu-review-backend/internal/domain/repository"
)

type ListProgramsUseCase struct {
	repo repository.ReviewRepository
}

func NewListPrograms(repo repository.ReviewRepository) *ListProgramsUseCase {
	return &ListProgramsUseCase{repo: repo}
}

func (uc *ListProgramsUseCase) Execute(ctx context.Context) ([]string, error) {
	return uc.repo.ListDistinctPrograms(ctx)
}
