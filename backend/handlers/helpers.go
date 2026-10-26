package handlers

import (
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// getTenantID resolves the tenant ID from context, X-Tenant-ID header, query param, or fallback 1.
func getTenantID(c *gin.Context) uint {
	if ctxVal, exists := c.Get("tenantID"); exists {
		if id, ok := ctxVal.(uint); ok && id > 0 {
			return id
		}
	}

	// 1. Tentar pegar do header X-Tenant-ID
	if headerVal := strings.TrimSpace(c.GetHeader("X-Tenant-ID")); headerVal != "" {
		if id, err := strconv.Atoi(headerVal); err == nil && id > 0 {
			return uint(id)
		}
	}
	// 2. Tentar pegar da Query string ?tenant_id=
	if queryVal := strings.TrimSpace(c.Query("tenant_id")); queryVal != "" {
		if id, err := strconv.Atoi(queryVal); err == nil && id > 0 {
			return uint(id)
		}
	}
	// Padrão: Tenant 1 (AZ3D)
	return 1
}

// getUserID extracts the authenticated user ID from gin context.
func getUserID(c *gin.Context) (uint, bool) {
	if val, exists := c.Get("userID"); exists {
		if id, ok := val.(uint); ok && id > 0 {
			return id, true
		}
	}
	return 0, false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "23505") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "already exists")
}

func isForeignKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "foreign key") ||
		strings.Contains(msg, "23503") ||
		strings.Contains(msg, "violates foreign key constraint")
}
