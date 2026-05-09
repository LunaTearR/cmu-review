package middleware

import (
	"crypto/sha256"
	"encoding/hex"

	"github.com/gin-gonic/gin"

	"cmu-review-backend/internal/usecase/port"
)

const actorKey = "actor"

type anonymousActor struct {
	hash string
}

func (a anonymousActor) SubmitterHash() string { return a.hash }
func (a anonymousActor) UserID() *int          { return nil }

func Actor() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		ua := c.Request.UserAgent()
		h := sha256.New()
		h.Write([]byte(ip + ":" + ua))
		hash := hex.EncodeToString(h.Sum(nil))
		c.Set(actorKey, port.Actor(anonymousActor{hash: hash}))
		c.Next()
	}
}

func ActorFromContext(c *gin.Context) port.Actor {
	if v, exists := c.Get(actorKey); exists {
		if a, ok := v.(port.Actor); ok {
			return a
		}
	}
	return anonymousActor{}
}
