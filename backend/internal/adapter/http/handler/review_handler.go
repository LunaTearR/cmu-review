package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"cmu-review-backend/internal/adapter/http/dto"
	"cmu-review-backend/internal/adapter/http/middleware"
	domainerrors "cmu-review-backend/internal/domain/errors"
	reviewuc "cmu-review-backend/internal/usecase/review"
)

type ReviewHandler struct {
	create *reviewuc.CreateReviewUseCase
	list   *reviewuc.ListReviewsByCourseUseCase
}

func NewReviewHandler(
	create *reviewuc.CreateReviewUseCase,
	list *reviewuc.ListReviewsByCourseUseCase,
) *ReviewHandler {
	return &ReviewHandler{create: create, list: list}
}

func (h *ReviewHandler) Create(c *gin.Context) {
	courseID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	var body dto.CreateReviewRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	out, err := h.create.Execute(c.Request.Context(), reviewuc.CreateReviewInput{
		CourseID:      courseID,
		Actor:         middleware.ActorFromContext(c),
		Rating:        body.Rating,
		Grade:         body.Grade,
		AcademicYear:  body.AcademicYear,
		Semester:      body.Semester,
		Content:       body.Content,
		HoneypotValue: body.Website,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	resp := dto.ToReviewResponse(out)
	c.JSON(http.StatusCreated, resp)
}

func (h *ReviewHandler) List(c *gin.Context) {
	courseID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	reviews, total, err := h.list.Execute(c.Request.Context(), reviewuc.ListReviewsInput{
		CourseID: courseID,
		Page:     page,
		Limit:    limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp := dto.ReviewListResponse{
		Data:  make([]dto.ReviewResponse, len(reviews)),
		Total: total,
		Page:  page,
		Limit: limit,
	}
	for i := range reviews {
		resp.Data[i] = dto.ToReviewResponse(&reviews[i])
	}
	c.JSON(http.StatusOK, resp)
}

func respondError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domainerrors.ErrCourseNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, domainerrors.ErrDuplicateReview):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, domainerrors.ErrRateLimited):
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
	case errors.Is(err, domainerrors.ErrHoneypotTripped),
		errors.Is(err, domainerrors.ErrInvalidRating),
		errors.Is(err, domainerrors.ErrInvalidSemester),
		errors.Is(err, domainerrors.ErrContentTooShort):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}
