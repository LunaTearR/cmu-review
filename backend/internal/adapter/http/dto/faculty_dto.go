package dto

import "cmu-review-backend/internal/domain/entity"

type FacultyResponse struct {
	ID     int    `json:"id"`
	Code   string `json:"code"`
	NameTH string `json:"name_th"`
	NameEN string `json:"name_en"`
}

func ToFacultyResponse(f entity.Faculty) FacultyResponse {
	return FacultyResponse{
		ID:     f.ID,
		Code:   f.Code,
		NameTH: f.NameTH,
		NameEN: f.NameEN,
	}
}
