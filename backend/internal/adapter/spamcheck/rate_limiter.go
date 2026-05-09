package spamcheck

import (
	"context"
	"time"

	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/domain/repository"
	"cmu-review-backend/internal/usecase/port"
)

type RateLimitChecker struct {
	reviews repository.ReviewRepository
	limit   int
	window  time.Duration
}

func NewRateLimitChecker(reviews repository.ReviewRepository, limit int, window time.Duration) *RateLimitChecker {
	return &RateLimitChecker{reviews: reviews, limit: limit, window: window}
}

func (c *RateLimitChecker) Check(ctx context.Context, in port.SpamInput) error {
	since := time.Now().Add(-c.window)
	count, err := c.reviews.CountRecentByHash(ctx, in.SubmitterHash, since)
	if err != nil {
		return err
	}
	if count >= c.limit {
		return domainerrors.ErrRateLimited
	}
	return nil
}
