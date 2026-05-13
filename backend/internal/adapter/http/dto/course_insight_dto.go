package dto

import "cmu-review-backend/internal/domain/entity"

type CourseInsightTag struct {
	Tag        string  `json:"tag"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type CourseInsightGroup struct {
	Key   string             `json:"key"`
	Title string             `json:"title"`
	Base  int                `json:"base"`
	Tags  []CourseInsightTag `json:"tags"`
}

type CourseInsightResponse struct {
	TotalReviews       int                  `json:"total_reviews"`
	MinReviewsForStats int                  `json:"min_reviews_for_stats"`
	Groups             []CourseInsightGroup `json:"groups"`
	Badges             []string             `json:"badges"`
	Warnings           []string             `json:"warnings"`
}

func ToCourseInsightResponse(in *entity.CourseInsight) CourseInsightResponse {
	groups := make([]CourseInsightGroup, len(in.Groups))
	for i, g := range in.Groups {
		tags := make([]CourseInsightTag, len(g.Tags))
		for j, t := range g.Tags {
			tags[j] = CourseInsightTag{
				Tag:        t.Tag,
				Count:      t.Count,
				Percentage: t.Percentage,
			}
		}
		groups[i] = CourseInsightGroup{
			Key:   g.Key,
			Title: g.Title,
			Base:  g.Base,
			Tags:  tags,
		}
	}
	badges := in.Badges
	if badges == nil {
		badges = []string{}
	}
	warnings := in.Warnings
	if warnings == nil {
		warnings = []string{}
	}
	return CourseInsightResponse{
		TotalReviews:       in.TotalReviews,
		MinReviewsForStats: in.MinReviewsForStats,
		Groups:             groups,
		Badges:             badges,
		Warnings:           warnings,
	}
}
