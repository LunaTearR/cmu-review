package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"cmu-review-backend/internal/adapter/http/dto"
	courseuc "cmu-review-backend/internal/usecase/course"
)

type SemanticSearchHandler struct {
	search *courseuc.SemanticSearchCoursesUseCase
}

func NewSemanticSearchHandler(search *courseuc.SemanticSearchCoursesUseCase) *SemanticSearchHandler {
	return &SemanticSearchHandler{search: search}
}

// Search handles GET /api/v1/courses/semantic-search?q=...&limit=10
func (h *SemanticSearchHandler) Search(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing query param 'q'"})
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))

	var tags []string
	if raw := c.Query("tags"); raw != "" {
		for _, t := range strings.Split(raw, ",") {
			if t = strings.TrimSpace(t); t != "" {
				tags = append(tags, t)
			}
		}
	}

	hits, err := h.search.Execute(c.Request.Context(), courseuc.SemanticSearchInput{
		Query:        q,
		Limit:        limit,
		RequiredTags: tags,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.ToSemanticSearchResponse(q, hits))
}
