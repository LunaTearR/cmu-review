package spamcheck

import (
	"context"
	"strings"

	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/usecase/port"
)

type ContentValidator struct {
	MinLen int
}

func (cv ContentValidator) Check(_ context.Context, in port.SpamInput) error {
	if len(strings.TrimSpace(in.Content)) < cv.MinLen {
		return domainerrors.ErrContentTooShort
	}
	return nil
}

// Pipeline runs checkers in order, short-circuiting on first error.
type Pipeline []port.SpamChecker

func (p Pipeline) Check(ctx context.Context, in port.SpamInput) error {
	for _, c := range p {
		if err := c.Check(ctx, in); err != nil {
			return err
		}
	}
	return nil
}
