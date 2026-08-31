package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"az3d-backend/database"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func installPlatformDeleteMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	gormDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = gormDB
	t.Cleanup(func() {
		database.DB = previous
		_ = sqlDB.Close()
	})
	return mock
}

func tenantDeleteContext(path string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodDelete, path, nil)
	ctx.Params = gin.Params{{Key: "tenant_id", Value: "4"}}
	ctx.Set("userRole", "master_admin")
	return ctx, recorder
}

func TestDeleteTenantUsesDatabaseCascadeAfterSafetyChecks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mock := installPlatformDeleteMockDB(t)
	mock.ExpectQuery(`SELECT .* FROM "tenants"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug"}).AddRow(4, "Loja teste", "loja-teste"))
	mock.ExpectQuery(`SELECT count\(\*\) FROM "users"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT count\(\*\) FROM "tenants"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "tenants" WHERE "tenants"\."id" = \$1`).
		WithArgs(uint(4)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	ctx, recorder := tenantDeleteContext("/api/admin/platform/tenants/4?confirm_slug=loja-teste")
	NewPlatformHandler(nil).DeleteTenant(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteTenantRequiresExactSlugConfirmation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mock := installPlatformDeleteMockDB(t)
	mock.ExpectQuery(`SELECT .* FROM "tenants"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug"}).AddRow(4, "Loja teste", "loja-teste"))

	ctx, recorder := tenantDeleteContext("/api/admin/platform/tenants/4?confirm_slug=outra-loja")
	NewPlatformHandler(nil).DeleteTenant(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteTenantProtectsMasterAdminTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mock := installPlatformDeleteMockDB(t)
	mock.ExpectQuery(`SELECT .* FROM "tenants"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug"}).AddRow(4, "Loja teste", "loja-teste"))
	mock.ExpectQuery(`SELECT count\(\*\) FROM "users"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	ctx, recorder := tenantDeleteContext("/api/admin/platform/tenants/4?confirm_slug=loja-teste")
	NewPlatformHandler(nil).DeleteTenant(ctx)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
