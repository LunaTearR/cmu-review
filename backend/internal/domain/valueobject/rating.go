package valueobject

import domainerrors "cmu-review-backend/internal/domain/errors"

type Rating uint8

func NewRating(v uint8) (Rating, error) {
	if v < 1 || v > 5 {
		return 0, domainerrors.ErrInvalidRating
	}
	return Rating(v), nil
}
