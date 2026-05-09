package port

import "context"

type SpamInput struct {
	HoneypotValue string
	SubmitterHash string
	CourseID      int
	Content       string
}

type SpamChecker interface {
	Check(ctx context.Context, in SpamInput) error
}

type Actor interface {
	SubmitterHash() string
	UserID() *int // nil if anonymous
}
