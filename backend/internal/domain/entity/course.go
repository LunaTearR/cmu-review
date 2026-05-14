package entity

type Course struct {
	ID           int
	CourseCode   string // CMU code, e.g. "204111"
	NameEN       string
	NameTH       string
	Credits      uint8
	FacultyID    int
	Description  string
	Prerequisite string // free text, e.g. "204111 และ 204112" or ""
	Faculty               Faculty
	AvgRating             float64
	ReviewCount           int
	AISummary             string // cached LLM summary of reviews
	AISummaryReviewCount  int    // review count at the time AISummary was generated
	AISummaryLastReviewID int64  // max review.id included in the cached summary
}
