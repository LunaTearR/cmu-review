package dto

import (
	"time"

	"cmu-review-backend/internal/domain/entity"
)

type CreateReviewRequest struct {
	Rating       uint8  `json:"rating"        binding:"required,min=1,max=5"`
	Grade        string `json:"grade"`
	AcademicYear int    `json:"academic_year" binding:"required,min=2560"`
	Semester     int    `json:"semester"      binding:"required,min=1,max=3"`
	Content      string `json:"content"       binding:"required,min=10,max=2000"`
	Website      string `json:"website"`      // honeypot — must be empty
}

type ReviewResponse struct {
	ID           int    `json:"id"`
	Rating       uint8  `json:"rating"`
	Grade        string `json:"grade"`
	AcademicYear int    `json:"academic_year"`
	Semester     int    `json:"semester"`
	Content      string `json:"content"`
	CreatedAt    string `json:"created_at"`
}

type ReviewListResponse struct {
	Data  []ReviewResponse `json:"data"`
	Total int              `json:"total"`
	Page  int              `json:"page"`
	Limit int              `json:"limit"`
}

func ToReviewResponse(r *entity.Review) ReviewResponse {
	return ReviewResponse{
		ID:           r.ID,
		Rating:       r.Rating,
		Grade:        r.Grade,
		AcademicYear: r.AcademicYear,
		Semester:     r.Semester,
		Content:      r.Content,
		CreatedAt:    r.CreatedAt.UTC().Format(time.RFC3339),
	}
}
