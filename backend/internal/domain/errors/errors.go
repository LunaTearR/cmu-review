package errors

import "errors"

var (
	ErrCourseNotFound  = errors.New("course not found")
	ErrReviewNotFound  = errors.New("review not found")
	ErrDuplicateCourse = errors.New("course with this ID already exists")
	ErrDuplicateReview = errors.New("you have already reviewed this course for this term")
	ErrFacultyNotFound = errors.New("faculty not found")
	ErrMajorNotFound   = errors.New("major not found")
	ErrHoneypotTripped = errors.New("invalid submission")
	ErrRateLimited     = errors.New("too many submissions, please try again later")
	ErrContentTooShort = errors.New("review content is too short")
	ErrInvalidRating   = errors.New("rating must be between 1 and 5")
	ErrInvalidSemester = errors.New("semester must be 1, 2, or 3")
)
