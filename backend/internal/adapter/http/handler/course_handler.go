package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"cmu-review-backend/internal/adapter/http/dto"
	domainerrors "cmu-review-backend/internal/domain/errors"
	courseuc "cmu-review-backend/internal/usecase/course"
)

type CourseHandler struct {
	create *courseuc.CreateCourseUseCase
	list   *courseuc.ListCoursesUseCase
	get    *courseuc.GetCourseUseCase
}

func NewCourseHandler(
	create *courseuc.CreateCourseUseCase,
	list *courseuc.ListCoursesUseCase,
	get *courseuc.GetCourseUseCase,
) *CourseHandler {
	return &CourseHandler{create: create, list: list, get: get}
}

func (h *CourseHandler) Create(c *gin.Context) {
	var body dto.CreateCourseRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	out, err := h.create.Execute(c.Request.Context(), courseuc.CreateCourseInput{
		CourseCode:   body.CourseCode,
		NameTH:       body.NameTH,
		NameEN:       body.NameEN,
		Credits:      body.Credits,
		FacultyID:    body.FacultyID,
		Description:  body.Description,
		Prerequisite: body.Prerequisite,
	})
	if err != nil {
		switch {
		case errors.Is(err, domainerrors.ErrDuplicateCourse):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case errors.Is(err, domainerrors.ErrFacultyNotFound):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}
	c.JSON(http.StatusCreated, dto.ToCourseResponse(out))
}

func (h *CourseHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	credits, _ := strconv.Atoi(c.Query("credits"))

	// `faculty` accepts a comma-separated list of codes (e.g. "ENG,SCI") for multi-select.
	var faculties []string
	if raw := c.Query("faculty"); raw != "" {
		for _, code := range strings.Split(raw, ",") {
			if code = strings.TrimSpace(code); code != "" {
				faculties = append(faculties, code)
			}
		}
	}

	courses, total, err := h.list.Execute(c.Request.Context(), courseuc.ListCoursesInput{
		Search:    c.Query("search"),
		Faculties: faculties,
		Credits:   credits,
		Category:  c.Query("category"),
		SortBy:    c.Query("sort"),
		Page:      page,
		Limit:     limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp := dto.CourseListResponse{
		Data:  make([]dto.CourseResponse, len(courses)),
		Total: total,
		Page:  page,
		Limit: limit,
	}
	for i := range courses {
		resp.Data[i] = dto.ToCourseResponse(&courses[i])
	}
	c.JSON(http.StatusOK, resp)
}

func (h *CourseHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	course, err := h.get.Execute(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, domainerrors.ErrCourseNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.ToCourseResponse(course))
}
