package main

import (
	"context"
	"log"
	"os"
	"os/signal"

	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/internal/mcpserver"

	"github.com/joho/godotenv"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	_ = godotenv.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	connector := mercadolivre.New()
	accounts := mcpserver.NewEnvironmentAccountSource(connector)
	server := mcpserver.New(connector, accounts).MCPServer()

	// STDIO reserves stdout for JSON-RPC. All diagnostics must go to stderr.
	logger := log.New(os.Stderr, "az3d-seller-mcp: ", log.LstdFlags)
	if err := server.Run(ctx, &mcp.StdioTransport{}); err != nil {
		logger.Printf("servidor finalizado: %v", err)
	}
}
