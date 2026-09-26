package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"az3d-backend/config"

	"github.com/gin-gonic/gin"
)

func TestAppInitializationAndHealthRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Env:            "test",
		Port:           "8080",
		JWTSecret:      "test-secret-at-least-32-bytes-long-12345",
		CORSOrigins:    []string{"http://localhost:5173"},
		TrustedProxies: []string{"127.0.0.1"},
		MaxUploadBytes: 5 * 1024 * 1024,
	}

	application := New(cfg, nil)
	if application == nil {
		t.Fatal("expected app to be initialized, got nil")
	}
	if application.Router == nil {
		t.Fatal("expected router to be initialized, got nil")
	}
	if application.Handlers == nil {
		t.Fatal("expected handlers container to be initialized, got nil")
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/health", nil)
	application.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}
