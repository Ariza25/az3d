package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"az3d-backend/config"
	"az3d-backend/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// App manages the application state, router, background jobs, and HTTP lifecycle.
type App struct {
	Config   *config.Config
	DB       *gorm.DB
	Handlers *Handlers
	Router   *gin.Engine
}

// New creates and initializes a new App instance.
func New(cfg *config.Config, db *gorm.DB) *App {
	h := NewHandlers(cfg, db)
	router := BuildRouter(cfg, h)

	return &App{
		Config:   cfg,
		DB:       db,
		Handlers: h,
		Router:   router,
	}
}

// StartBackgroundJobs launches all background synchronization and maintenance workers.
func (a *App) StartBackgroundJobs(ctx context.Context) {
	handlers.StartTrackingSyncJob(ctx, a.Config)
	handlers.StartMarketplaceSyncJob(ctx, a.Config, a.Handlers.Marketplace)
	handlers.StartExpiredPixJob(ctx)
}

// Run starts the HTTP server and blocks until the context is cancelled, performing graceful shutdown.
func (a *App) Run(ctx context.Context) error {
	a.StartBackgroundJobs(ctx)

	addr := fmt.Sprintf(":%s", a.Config.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      a.Router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("Servidor Go AZ3D escutando na porta %s (http://localhost:%s)", a.Config.Port, a.Config.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case <-ctx.Done():
		log.Println("Sinal de encerramento recebido. Finalizando servidor graciosamente...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	case err := <-serverErr:
		return err
	}
}
