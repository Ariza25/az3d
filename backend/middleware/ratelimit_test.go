package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRateLimiter_Allow(t *testing.T) {
	limiter := NewRateLimiter(60, 3)

	key := "127.0.0.1"

	// Initial burst capacity is 3
	for i := 0; i < 3; i++ {
		if !limiter.Allow(key) {
			t.Fatalf("esperava requisicao %d permitida dentro do burst", i+1)
		}
	}

	// 4th immediate request exceeds burst
	if limiter.Allow(key) {
		t.Fatalf("esperava requisicao 4 bloqueada pelo rate limit")
	}

	// Another client key should be allowed
	if !limiter.Allow("192.168.1.100") {
		t.Fatalf("esperava cliente diferente permitido")
	}
}

func TestRateLimiterMiddleware_HTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimiterMiddleware(60, 2))
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	// 1st request -> 200
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", w1.Code)
	}

	// 2nd request -> 200
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("esperava status 200, recebeu %d", w2.Code)
	}

	// 3rd request -> 429 Too Many Requests
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusTooManyRequests {
		t.Fatalf("esperava status 429, recebeu %d", w3.Code)
	}
	if w3.Header().Get("Retry-After") == "" {
		t.Fatalf("esperava header Retry-After presente")
	}
}
