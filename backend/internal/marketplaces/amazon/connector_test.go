package amazon

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	mp "az3d-backend/internal/marketplaces"
)

func TestConnectionClassifiesUnauthorizedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-amz-date") == "" || r.Header.Get("User-Agent") == "" {
			t.Errorf("required Amazon headers missing: %#v", r.Header)
		}
		http.Error(w, `{"message":"Unauthorized"}`, http.StatusUnauthorized)
	}))
	defer server.Close()
	t.Setenv("AMAZON_SP_API_BASE_URL", server.URL)
	t.Setenv("AMAZON_SP_API_AUTHORIZATION", "test-signature")

	err := New().TestConnection(context.Background(), mp.Account{AccessToken: "expired-token"})
	if !IsUnauthorized(err) {
		t.Fatalf("error should be classified as unauthorized: %v", err)
	}
}
