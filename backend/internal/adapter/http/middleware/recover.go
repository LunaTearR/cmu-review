package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, _ any) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		c.Abort()
	})
}
