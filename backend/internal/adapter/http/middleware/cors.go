package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost", "http://localhost:8000", "http://localhost:5173", "http://localhost:3000"},
		AllowMethods: []string{"GET", "POST","PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Accept", "Content-Type", "X-Request-ID"},
	})
}
