package superfrete

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCalculateQuotesSuccess(t *testing.T) {
	mockResponse := `[
		{
			"id": 1,
			"name": "PAC",
			"price": 24.50,
			"discount": 3.50,
			"currency": "R$",
			"delivery_time": 6,
			"delivery_range": {"min": 5, "max": 7},
			"company": {"id": 1, "name": "Correios"},
			"has_error": false
		},
		{
			"id": 2,
			"name": "SEDEX",
			"price": 35.80,
			"discount": null,
			"currency": "R$",
			"delivery_time": 2,
			"delivery_range": {"min": 1, "max": 3},
			"company": {"id": 1, "name": "Correios"},
			"has_error": false
		},
		{
			"id": 17,
			"name": "Mini Envios",
			"price": 14.20,
			"discount": "2.00",
			"currency": "R$",
			"delivery_time": 8,
			"delivery_range": {"min": 7, "max": 9},
			"company": {"id": 1, "name": "Correios"},
			"has_error": false
		}
	]`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/calculator" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			http.NotFound(w, r)
			return
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-token" {
			t.Errorf("unexpected auth header: %s", auth)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(mockResponse))
	}))
	defer server.Close()

	connector := New(server.URL, "test-token")
	options, err := connector.CalculateQuotes(context.Background(), "01310-100", "20040-002", 0.5, 10, 15, 20)
	if err != nil {
		t.Fatalf("CalculateQuotes failed: %v", err)
	}

	if len(options) != 3 {
		t.Fatalf("expected 3 options, got %d", len(options))
	}

	if options[0].Code != "superfrete_pac" || options[0].Price != 24.50 || options[0].DeliveryDays != 6 {
		t.Errorf("unexpected option[0]: %+v", options[0])
	}
	if options[1].Code != "superfrete_sedex" || options[1].Price != 35.80 || options[1].DeliveryDays != 2 {
		t.Errorf("unexpected option[1]: %+v", options[1])
	}
	if options[2].Code != "superfrete_mini" || options[2].Price != 14.20 || options[2].DeliveryDays != 8 {
		t.Errorf("unexpected option[2]: %+v", options[2])
	}
}

func TestCalculateQuotesInvalidCEP(t *testing.T) {
	connector := New("https://api.superfrete.com", "test-token")
	_, err := connector.CalculateQuotes(context.Background(), "123", "20040-002", 0.5, 10, 15, 20)
	if err == nil {
		t.Error("expected error for invalid CEP, got nil")
	}
}

func TestCalculateQuotesMissingToken(t *testing.T) {
	connector := New("https://api.superfrete.com", "")
	_, err := connector.CalculateQuotes(context.Background(), "01310-100", "20040-002", 0.5, 10, 15, 20)
	if err == nil {
		t.Error("expected error for missing token, got nil")
	}
}

func TestTestConnection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer valid-token" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id": 1, "name": "Matheus"}`))
		} else {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error": "Unauthorized"}`))
		}
	}))
	defer server.Close()

	validConn := New(server.URL, "valid-token")
	if err := validConn.TestConnection(context.Background()); err != nil {
		t.Errorf("expected connection success, got: %v", err)
	}

	invalidConn := New(server.URL, "bad-token")
	if err := invalidConn.TestConnection(context.Background()); err == nil {
		t.Error("expected connection error for bad token, got nil")
	}
}
