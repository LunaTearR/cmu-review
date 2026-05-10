package entity

import "time"

type Review struct {
	ID           int
	CourseID     int    // FK → courses.id
	UserID       *int   // nil = anonymous
	Rating       uint8  // 1–5
	Grade        string // "" = not specified
	AcademicYear int    // Buddhist era year, e.g. 2567
	Semester     int    // 1, 2, or 3
	Content      string
	Category     string // optional, e.g. "หมวดวิชาบังคับ" or "หมวดวิชาเลือก"
	Program      string // optional, e.g. "ภาคปกติ" or "ภาคพิเศษ"
	Professor    string // optional, e.g. "อาจารย์สมชาย"
	IPHash       string // sha256(ip:ua) — never raw PII
	IsHidden     bool
	CreatedAt    time.Time
}
