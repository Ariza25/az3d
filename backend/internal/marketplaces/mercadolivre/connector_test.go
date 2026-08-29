package mercadolivre

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mp "az3d-backend/internal/marketplaces"
)

func TestUnauthorizedResponseIsTypedAndDoesNotExposeCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"token secret-token invalid"}`, http.StatusUnauthorized)
	}))
	defer server.Close()
	t.Setenv("MELI_API_BASE_URL", server.URL)

	err := New().TestConnection(context.Background(), mp.Account{AccessToken: "secret-token"})
	if !IsUnauthorized(err) {
		t.Fatalf("error should be typed as unauthorized: %v", err)
	}
	if strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("credential leaked in error: %v", err)
	}
}
