package repository

import (
	"context"

	"cmu-review-backend/internal/domain/entity"
)

// SortBy values: "code" | "rating" | "reviews" | ""
type CourseListOpts struct {
	Search  string
	Faculty string
	Credits int // 0 = all
	SortBy  string
	Limit   int
	Offset  int
}

type CourseRepository interface {
	Exists(ctx context.Context, id int) (bool, error)
	Create(ctx context.Context, c *entity.Course) (*entity.Course, error)
	List(ctx context.Context, opts CourseListOpts) ([]entity.Course, int, error)
	GetByID(ctx context.Context, id int) (*entity.Course, error)
}
