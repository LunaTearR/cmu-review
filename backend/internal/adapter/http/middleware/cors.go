package middleware

import (
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type CorsConfig struct {
	AllowOrigins string
	AllowMethods string
	AllowHeaders string
}

func CORS(cfg CorsConfig) gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins: strings.Split(cfg.AllowOrigins, ","),
		AllowMethods: strings.Split(cfg.AllowMethods, ","),
		AllowHeaders: strings.Split(cfg.AllowHeaders, ","),
	})
}
