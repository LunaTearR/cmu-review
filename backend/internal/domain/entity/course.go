package entity

type Course struct {
	ID          int
	CourseCode  string // CMU code, e.g. "204111"
	NameEN      string
	NameTH      string
	Credits     uint8
	FacultyID   int
	Description string
	Faculty     Faculty
	AvgRating   float64
	ReviewCount int
}
