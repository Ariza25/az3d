package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/app"
)

func main() {
	cfg := config.LoadConfig()

	if cfg.DatabaseURL != "" || cfg.DatabaseRequired {
		database.InitDB(cfg)
	} else {
		log.Println("Aviso: backend iniciado sem banco; defina DATABASE_URL para conectar o Neon")
	}

	application := app.New(cfg, database.DB)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := application.Run(ctx); err != nil {
		log.Fatalf("Erro ao executar servidor Go: %v", err)
	}
}
