package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"cmu-review-backend/internal/adapter/http/dto"
	facultyuc "cmu-review-backend/internal/usecase/faculty"
)

type FacultyHandler struct {
	list *facultyuc.ListFacultiesUseCase
}

func NewFacultyHandler(list *facultyuc.ListFacultiesUseCase) *FacultyHandler {
	return &FacultyHandler{list: list}
}

func (h *FacultyHandler) List(c *gin.Context) {
	faculties, err := h.list.Execute(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	resp := make([]dto.FacultyResponse, len(faculties))
	for i, f := range faculties {
		resp[i] = dto.ToFacultyResponse(f)
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}
