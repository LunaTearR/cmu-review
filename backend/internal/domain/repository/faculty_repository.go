package repository

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
)

type FacultyRepository interface {
	ListAll(ctx context.Context) ([]entity.Faculty, error)
}
