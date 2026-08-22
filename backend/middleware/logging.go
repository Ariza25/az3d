package middleware

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func StructuredLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		entry := map[string]any{
			"level":      "info",
			"event":      "http_request",
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"status":     c.Writer.Status(),
			"latency_ms": time.Since(start).Milliseconds(),
			"client_ip":  c.ClientIP(),
			"tenant_id":  c.GetHeader("X-Tenant-ID"),
			"user_agent": c.Request.UserAgent(),
			"request_id": c.GetHeader("X-Request-ID"),
		}
		if len(c.Errors) > 0 {
			entry["level"] = "error"
			entry["error"] = c.Errors.String()
		}

		payload, err := json.Marshal(entry)
		if err != nil {
			log.Printf("http_request status=%d method=%s path=%s", c.Writer.Status(), c.Request.Method, c.Request.URL.Path)
			return
		}
		log.Print(string(payload))
	}
}
