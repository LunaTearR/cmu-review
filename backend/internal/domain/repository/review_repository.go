package repository

import (
	"context"
	"time"

	"cmu-review-backend/internal/domain/entity"
)

type ReviewRepository interface {
	Create(ctx context.Context, r *entity.Review) (*entity.Review, error)
	ListByCourse(ctx context.Context, courseID int, opts ListOpts) ([]entity.Review, int, error)
	CountRecentByHash(ctx context.Context, ipHash string, since time.Time) (int, error)
}

type ListOpts struct {
	Limit  int
	Offset int
}
