package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"cmu-review-backend/configs"
	"cmu-review-backend/internal/adapter/http/handler"
	"cmu-review-backend/internal/adapter/http/middleware"
)

func Register(
	r *gin.Engine,
	reviewHandler *handler.ReviewHandler,
	facultyHandler *handler.FacultyHandler,
	courseHandler *handler.CourseHandler,
	cors configs.CorsConfig,
) {
	r.Use(middleware.CORS(middleware.CorsConfig{
		AllowOrigins: cors.AllowOrigins,
		AllowMethods: cors.AllowMethods,
		AllowHeaders: cors.AllowHeaders,
	}))
	r.Use(middleware.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Actor())

	r.GET("/healthz", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	v1 := r.Group("/api/v1")
	v1.Use(middleware.RateLimit(200, time.Minute))

	v1.GET("/courses", courseHandler.List)
	v1.POST("/courses", courseHandler.Create)
	v1.GET("/courses/:id", courseHandler.Get)
	v1.GET("/courses/:id/reviews", reviewHandler.List)
	v1.POST("/courses/:id/reviews", reviewHandler.Create)

	v1.GET("/faculties", facultyHandler.List)
	v1.GET("/programs", reviewHandler.ListPrograms)
}
