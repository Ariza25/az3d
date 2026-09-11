package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type clientRate struct {
	tokens     float64
	lastRefill time.Time
}

// RateLimiter implements a token bucket rate limiter per client IP.
type RateLimiter struct {
	mu      sync.RWMutex
	clients map[string]*clientRate
	rate    float64 // tokens per second
	burst   float64 // maximum tokens bucket can hold
	stopCh  chan struct{}
}

// NewRateLimiter creates a new RateLimiter with the specified rate (requests/minute) and burst capacity.
func NewRateLimiter(requestsPerMinute int, burst int) *RateLimiter {
	rl := &RateLimiter{
		clients: make(map[string]*clientRate),
		rate:    float64(requestsPerMinute) / 60.0,
		burst:   float64(burst),
		stopCh:  make(chan struct{}),
	}

	go rl.cleanupRoutine(10 * time.Minute)
	return rl
}

func (rl *RateLimiter) cleanupRoutine(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now()
			for ip, client := range rl.clients {
				if now.Sub(client.lastRefill) > 15*time.Minute {
					delete(rl.clients, ip)
				}
			}
			rl.mu.Unlock()
		case <-rl.stopCh:
			return
		}
	}
}

// Allow checks if a request from key is permitted under the rate limit.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	client, exists := rl.clients[key]
	if !exists {
		rl.clients[key] = &clientRate{
			tokens:     rl.burst - 1,
			lastRefill: now,
		}
		return true
	}

	elapsed := now.Sub(client.lastRefill).Seconds()
	client.tokens += elapsed * rl.rate
	if client.tokens > rl.burst {
		client.tokens = rl.burst
	}
	client.lastRefill = now

	if client.tokens >= 1.0 {
		client.tokens -= 1.0
		return true
	}

	return false
}

// RateLimiterMiddleware returns a Gin middleware for rate limiting.
func RateLimiterMiddleware(requestsPerMinute int, burst int) gin.HandlerFunc {
	limiter := NewRateLimiter(requestsPerMinute, burst)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if clientIP == "" {
			clientIP = c.RemoteIP()
		}

		if !limiter.Allow(clientIP) {
			c.Header("Retry-After", "5")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Muitas requisições em pouco tempo. Aguarde alguns segundos antes de tentar novamente.",
			})
			return
		}

		c.Next()
	}
}
