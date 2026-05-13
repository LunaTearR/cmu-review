package dto

import (
	"time"

	"cmu-review-backend/internal/domain/entity"
)

type CreateReviewRequest struct {
	Rating       uint8  `json:"rating"         binding:"required,min=1,max=5"`
	Grade        string `json:"grade"`
	AcademicYear int    `json:"academic_year"  binding:"required,min=2560"`
	Semester     int    `json:"semester"       binding:"required,min=1,max=3"`
	Content      string `json:"content"        binding:"required,min=10,max=2000"`
	Category     string `json:"category"       binding:"max=255"`
	Program      string `json:"program"        binding:"max=255"`
	Professor    string `json:"professor"      binding:"max=255"`
	ReviewerName string   `json:"reviewer_name"  binding:"max=100"`
	InsightTags  []string `json:"insight_tags"   binding:"max=32,dive,max=64"`
	Website      string   `json:"website"` // honeypot — must be empty
}

type ReviewResponse struct {
	ID           int      `json:"id"`
	Rating       uint8    `json:"rating"`
	Grade        string   `json:"grade"`
	AcademicYear int      `json:"academic_year"`
	Semester     int      `json:"semester"`
	Content      string   `json:"content"`
	Category     string   `json:"category"`
	Program      string   `json:"program"`
	Professor    string   `json:"professor"`
	ReviewerName string   `json:"reviewer_name"`
	InsightTags  []string `json:"insight_tags"`
	CreatedAt    string   `json:"created_at"`
}

type ReviewListResponse struct {
	Data  []ReviewResponse `json:"data"`
	Total int              `json:"total"`
	Page  int              `json:"page"`
	Limit int              `json:"limit"`
}

func ToReviewResponse(r *entity.Review) ReviewResponse {
	tags := r.InsightTags
	if tags == nil {
		tags = []string{}
	}
	return ReviewResponse{
		ID:           r.ID,
		Rating:       r.Rating,
		Grade:        r.Grade,
		AcademicYear: r.AcademicYear,
		Semester:     r.Semester,
		Content:      r.Content,
		Category:     r.Category,
		Program:      r.Program,
		Professor:    r.Professor,
		ReviewerName: r.ReviewerName,
		InsightTags:  tags,
		CreatedAt:    r.CreatedAt.UTC().Format(time.RFC3339),
	}
}
