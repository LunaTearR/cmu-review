package spamcheck

import (
	"context"

	domainerrors "cmu-review-backend/internal/domain/errors"
	"cmu-review-backend/internal/usecase/port"
)

type HoneypotChecker struct{}

func (HoneypotChecker) Check(_ context.Context, in port.SpamInput) error {
	if in.HoneypotValue != "" {
		return domainerrors.ErrHoneypotTripped
	}
	return nil
}
