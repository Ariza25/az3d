package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/marketplaces/shopee"
	"az3d-backend/internal/mcpserver"

	"github.com/joho/godotenv"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	loadEnvironment()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	if err := run(ctx, os.Args[1:], os.Stdin, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "az3d-shopee-seller-mcp:", err)
		os.Exit(1)
	}
}

func loadEnvironment() {
	if executable, err := os.Executable(); err == nil {
		binDir := filepath.Dir(executable)
		if strings.EqualFold(filepath.Base(binDir), "bin") {
			_ = godotenv.Load(filepath.Join(filepath.Dir(binDir), ".env"))
		}
	}
	_ = godotenv.Load()
}

func run(ctx context.Context, args []string, _ io.Reader, output, errorOutput io.Writer) error {
	command := "serve"
	commandArgs := args
	if len(args) > 0 {
		command = args[0]
		commandArgs = args[1:]
	}

	switch command {
	case "serve", "doctor":
		flags := flag.NewFlagSet(command, flag.ContinueOnError)
		flags.SetOutput(errorOutput)
		tenantID := flags.Uint("tenant-id", 0, "tenant com loja Shopee autorizada no painel AZ3D")
		if err := flags.Parse(commandArgs); err != nil {
			return err
		}
		if *tenantID == 0 {
			return errors.New("informe --tenant-id com o tenant que autorizou a loja Shopee")
		}
		cfg := config.LoadConfig()
		if cfg.DatabaseURL == "" && !cfg.DatabaseRequired {
			return errors.New("o MCP requer o banco da plataforma; configure DATABASE_URL")
		}
		connector := shopee.New()
		db, err := database.OpenExistingDB(cfg)
		if err != nil {
			return fmt.Errorf("nao foi possivel conectar ao banco da plataforma: %w", err)
		}
		accounts := mcpserver.NewShopeeDatabaseAccountSource(db, connector, *tenantID, cfg.CredentialEncryptionKey)
		if command == "doctor" {
			result, err := mcpserver.RunDoctor(ctx, connector, accounts)
			if err != nil {
				return fmt.Errorf("diagnostico falhou: %w", err)
			}
			fmt.Fprintf(output, "OK: Shopee conectada; tenant=%d shop=%s marketplace=%s; get_shop_info respondeu com sucesso.\n", *tenantID, result.ShopID, result.Marketplace)
			return nil
		}
		server := mcpserver.New(connector, accounts).MCPServer()
		logger := log.New(errorOutput, "az3d-shopee-seller-mcp: ", log.LstdFlags)
		if err := server.Run(ctx, &mcp.StdioTransport{}); err != nil {
			logger.Printf("servidor finalizado: %v", err)
		}
		return nil
	case "help", "-h", "--help":
		fmt.Fprintln(output, "Uso: az3d-shopee-seller-mcp [serve|doctor] --tenant-id ID")
		return nil
	default:
		return fmt.Errorf("comando desconhecido %q; use help", command)
	}
}
