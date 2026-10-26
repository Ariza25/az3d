package handlers

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIsDuplicateKeyError(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errors.New("record not found"), false},
		{errors.New("ERROR: duplicate key value violates unique constraint \"idx_categories_slug\" (SQLSTATE 23505)"), true},
		{errors.New("pq: duplicate key value violates unique constraint \"categories_name_key\""), true},
		{errors.New("UNIQUE constraint failed: categories.name"), true},
		{errors.New("key already exists"), true},
	}

	for _, tt := range tests {
		got := isDuplicateKeyError(tt.err)
		if got != tt.want {
			t.Errorf("isDuplicateKeyError(%v) = %v, want %v", tt.err, got, tt.want)
		}
	}
}

func TestIsForeignKeyError(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errors.New("record not found"), false},
		{errors.New("ERROR: update or delete on table \"products\" violates foreign key constraint \"orders_product_id_fkey\" on table \"order_items\" (SQLSTATE 23503)"), true},
		{errors.New("FOREIGN KEY constraint failed"), true},
	}

	for _, tt := range tests {
		got := isForeignKeyError(tt.err)
		if got != tt.want {
			t.Errorf("isForeignKeyError(%v) = %v, want %v", tt.err, got, tt.want)
		}
	}
}

func TestGetTenantID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("from context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("tenantID", uint(42))

		got := getTenantID(c)
		if got != 42 {
			t.Errorf("expected tenantID 42, got %d", got)
		}
	})

	t.Run("from header", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("X-Tenant-ID", "99")

		got := getTenantID(c)
		if got != 99 {
			t.Errorf("expected tenantID 99, got %d", got)
		}
	})

	t.Run("from query param", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test?tenant_id=7", nil)

		got := getTenantID(c)
		if got != 7 {
			t.Errorf("expected tenantID 7, got %d", got)
		}
	})

	t.Run("default fallback", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		got := getTenantID(c)
		if got != 1 {
			t.Errorf("expected tenantID fallback 1, got %d", got)
		}
	})
}

func TestGetUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("found uint", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("userID", uint(123))

		id, ok := getUserID(c)
		if !ok || id != 123 {
			t.Errorf("expected (123, true), got (%d, %v)", id, ok)
		}
	})

	t.Run("not found", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		id, ok := getUserID(c)
		if ok || id != 0 {
			t.Errorf("expected (0, false), got (%d, %v)", id, ok)
		}
	})
}

func TestFirstNonEmpty(t *testing.T) {
	got := firstNonEmpty("", "  ", "hello", "world")
	if got != "hello" {
		t.Errorf("expected 'hello', got '%s'", got)
	}

	gotEmpty := firstNonEmpty("", "  ")
	if gotEmpty != "" {
		t.Errorf("expected '', got '%s'", gotEmpty)
	}
}
