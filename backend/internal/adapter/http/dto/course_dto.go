package dto

import "cmu-review-backend/internal/domain/entity"

type CreateCourseRequest struct {
	CourseCode   string `json:"course_id"    binding:"required,max=20"`
	NameTH       string `json:"name_th"      binding:"required,max=255"`
	NameEN       string `json:"name_en"      binding:"required,max=255"`
	Credits      uint8  `json:"credits"      binding:"required,min=1,max=12"`
	FacultyID    int    `json:"faculty_id"   binding:"required,min=1"`
	Description  string `json:"description"`
	Prerequisite string `json:"prerequisite" binding:"max=500"`
}

type FacultyEmbed struct {
	ID     int    `json:"id"`
	Code   string `json:"code"`
	NameTH string `json:"name_th"`
	NameEN string `json:"name_en"`
}

type CourseResponse struct {
	ID           int          `json:"id"`
	CourseCode   string       `json:"course_id"`
	NameTH       string       `json:"name_th"`
	NameEN       string       `json:"name_en"`
	Credits      uint8        `json:"credits"`
	Description  string       `json:"description"`
	Prerequisite string       `json:"prerequisite"`
	Faculty      FacultyEmbed `json:"faculty"`
	AvgRating    float64      `json:"avg_rating"`
	ReviewCount  int          `json:"review_count"`
	AISummary    string       `json:"ai_summary"`
}

type CourseListResponse struct {
	Data  []CourseResponse `json:"data"`
	Total int              `json:"total"`
	Page  int              `json:"page"`
	Limit int              `json:"limit"`
}

func ToCourseResponse(c *entity.Course) CourseResponse {
	return CourseResponse{
		ID:           c.ID,
		CourseCode:   c.CourseCode,
		NameTH:       c.NameTH,
		NameEN:       c.NameEN,
		Credits:      c.Credits,
		Description:  c.Description,
		Prerequisite: c.Prerequisite,
		Faculty: FacultyEmbed{
			ID:     c.Faculty.ID,
			Code:   c.Faculty.Code,
			NameTH: c.Faculty.NameTH,
			NameEN: c.Faculty.NameEN,
		},
		AvgRating:   c.AvgRating,
		ReviewCount: c.ReviewCount,
		AISummary:   c.AISummary,
	}
}
