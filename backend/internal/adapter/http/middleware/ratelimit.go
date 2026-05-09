package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipWindow struct {
	count    int
	windowAt time.Time
}

type httpRateLimiter struct {
	mu      sync.Mutex
	windows map[string]*ipWindow
	limit   int
	window  time.Duration
}

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	rl := &httpRateLimiter{
		windows: make(map[string]*ipWindow),
		limit:   limit,
		window:  window,
	}
	go rl.cleanup()
	return rl.handle
}

func (rl *httpRateLimiter) handle(c *gin.Context) {
	ip := c.ClientIP()

	rl.mu.Lock()
	w, ok := rl.windows[ip]
	if !ok || time.Since(w.windowAt) > rl.window {
		rl.windows[ip] = &ipWindow{count: 1, windowAt: time.Now()}
		rl.mu.Unlock()
		c.Next()
		return
	}
	w.count++
	over := w.count > rl.limit
	rl.mu.Unlock()

	if over {
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
		return
	}
	c.Next()
}

func (rl *httpRateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		for ip, w := range rl.windows {
			if time.Since(w.windowAt) > rl.window*2 {
				delete(rl.windows, ip)
			}
		}
		rl.mu.Unlock()
	}
}
