package dto

import "cmu-review-backend/internal/usecase/course"

type SemanticSearchHitResponse struct {
	Course        CourseResponse `json:"course"`
	Score         float64        `json:"score"`
	MatchedCount  int            `json:"matched_count"`
	TopReviewText string         `json:"top_review_text"`
}

type SemanticSearchResponse struct {
	Query string                      `json:"query"`
	Data  []SemanticSearchHitResponse `json:"data"`
}

func ToSemanticSearchResponse(query string, hits []course.SemanticCourseHit) SemanticSearchResponse {
	out := SemanticSearchResponse{
		Query: query,
		Data:  make([]SemanticSearchHitResponse, 0, len(hits)),
	}
	for i := range hits {
		out.Data = append(out.Data, SemanticSearchHitResponse{
			Course:        ToCourseResponse(hits[i].Course),
			Score:         hits[i].Score,
			MatchedCount:  hits[i].MatchedCount,
			TopReviewText: hits[i].TopReviewText,
		})
	}
	return out
}
