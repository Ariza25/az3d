package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdministrativeRoleBoundaries(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		role       string
		tenantID   uint
		middleware gin.HandlerFunc
		wantStatus int
	}{
		{name: "tenant admin accesses tenant operation", role: "tenant_admin", tenantID: 1, middleware: TenantAdminMiddleware(), wantStatus: http.StatusNoContent},
		{name: "legacy admin accesses tenant operation", role: "admin", tenantID: 1, middleware: TenantAdminMiddleware(), wantStatus: http.StatusNoContent},
		{name: "tenant admin without tenant is rejected", role: "tenant_admin", middleware: TenantAdminMiddleware(), wantStatus: http.StatusForbidden},
		{name: "master cannot access tenant operation", role: "master_admin", middleware: TenantAdminMiddleware(), wantStatus: http.StatusForbidden},
		{name: "master accesses platform control plane", role: "master_admin", middleware: MasterAdminMiddleware(), wantStatus: http.StatusNoContent},
		{name: "tenant admin cannot access platform control plane", role: "tenant_admin", middleware: MasterAdminMiddleware(), wantStatus: http.StatusForbidden},
		{name: "customer cannot access tenant operation", role: "customer", middleware: TenantAdminMiddleware(), wantStatus: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set("userRole", test.role)
				if test.tenantID > 0 {
					c.Set("tenantID", test.tenantID)
				}
				c.Next()
			}, test.middleware)
			router.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })

			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/", nil)
			router.ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", response.Code, test.wantStatus, response.Body.String())
			}
		})
	}
}
