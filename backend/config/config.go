package config

import (
	"log"
	"net/mail"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                       string
	Env                        string
	DatabaseURL                string
	DatabaseRequired           bool
	AdminLogin                 string
	AdminPassword              string
	DBHost                     string
	DBUser                     string
	DBPassword                 string
	DBName                     string
	DBPort                     string
	DBSSLMode                  string
	JWTSecret                  string
	JWTTTLHours                int
	CORSOrigins                []string
	TrustedProxies             []string
	MaxUploadBytes             int64
	RequireStrongSecrets       bool
	CredentialEncryptionKey    string
	CorreiosAPIBaseURL         string
	CorreiosTokenBaseURL       string
	TrackingSyncIntervalMin    int
	MarketplaceSyncIntervalMin int
	GoogleOAuthClientID        string
	GoogleOAuthClientSecret    string
	GoogleOAuthRedirectURL     string
	GoogleOAuthAuthURL         string
	GoogleOAuthTokenURL        string
	GoogleOAuthUserInfoURL     string
	FrontendBaseURL            string
	MercadoPagoClientID        string
	MercadoPagoClientSecret    string
	MercadoPagoRedirectURI     string
	MercadoPagoWebhookSecret   string
	MercadoLivreClientID       string
	MercadoLivreClientSecret   string
	MercadoLivreRedirectURI    string
	MercadoLivreWebhookSecret  string
}

func LoadConfig() *Config {
	// Tenta carregar .env, se não existir assume variáveis do ambiente
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: arquivo .env não encontrado, usando variáveis de ambiente do sistema")
	}

	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		Env:              getEnv("ENV", "development"),
		DatabaseURL:      getEnv("DATABASE_URL", ""),
		DatabaseRequired: getEnvBool("DATABASE_REQUIRED", true),
		AdminLogin:       getEnv("ADM_LOGIN", ""),
		AdminPassword:    getEnv("ADM_PASSWORD", ""),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBUser:           getEnv("DB_USER", "postgres"),
		DBPassword:       getEnv("DB_PASSWORD", "postgres"),
		DBName:           getEnv("DB_NAME", "az3d_db"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBSSLMode:        getEnv("DB_SSLMODE", "disable"),
		JWTSecret:        getEnv("JWT_SECRET", "az3d_default_jwt_secret_key"),
		JWTTTLHours:      getEnvInt("JWT_TTL_HOURS", 168),
		CORSOrigins: getEnvList("CORS_ALLOWED_ORIGINS", []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://localhost:5174",
			"http://localhost:5181",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:5174",
			"http://127.0.0.1:5181",
		}),
		TrustedProxies:             getEnvList("TRUSTED_PROXIES", []string{"127.0.0.1", "::1"}),
		MaxUploadBytes:             int64(getEnvInt("MAX_UPLOAD_MB", 5)) * 1024 * 1024,
		RequireStrongSecrets:       getEnvBool("REQUIRE_STRONG_SECRETS", false),
		CredentialEncryptionKey:    getEnv("CREDENTIAL_ENCRYPTION_KEY", ""),
		CorreiosAPIBaseURL:         getEnv("CORREIOS_API_BASE_URL", "https://api.correios.com.br/srorastro"),
		CorreiosTokenBaseURL:       getEnv("CORREIOS_TOKEN_BASE_URL", "https://api.correios.com.br/token"),
		TrackingSyncIntervalMin:    getEnvIntAllowZero("TRACKING_SYNC_INTERVAL_MINUTES", 0),
		MarketplaceSyncIntervalMin: getEnvIntAllowZero("MARKETPLACE_SYNC_INTERVAL_MINUTES", 1),
		GoogleOAuthClientID:        getEnv("GOOGLE_OAUTH_CLIENT_ID", ""),
		GoogleOAuthClientSecret:    getEnv("GOOGLE_OAUTH_CLIENT_SECRET", ""),
		GoogleOAuthRedirectURL:     getEnv("GOOGLE_OAUTH_REDIRECT_URL", ""),
		GoogleOAuthAuthURL:         getEnv("GOOGLE_OAUTH_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth"),
		GoogleOAuthTokenURL:        getEnv("GOOGLE_OAUTH_TOKEN_URL", "https://oauth2.googleapis.com/token"),
		GoogleOAuthUserInfoURL:     getEnv("GOOGLE_OAUTH_USERINFO_URL", "https://openidconnect.googleapis.com/v1/userinfo"),
		FrontendBaseURL:            getEnv("FRONTEND_BASE_URL", "http://localhost:5173"),
		MercadoPagoClientID:        getEnv("MERCADO_PAGO_CLIENT_ID", ""),
		MercadoPagoClientSecret:    getEnv("MERCADO_PAGO_CLIENT_SECRET", ""),
		MercadoPagoRedirectURI:     getEnv("MERCADO_PAGO_REDIRECT_URI", ""),
		MercadoPagoWebhookSecret:   getEnv("MERCADO_PAGO_WEBHOOK_SECRET", ""),
		MercadoLivreClientID:       getEnv("MELI_CLIENT_ID", ""),
		MercadoLivreClientSecret:   getEnv("MELI_CLIENT_SECRET", ""),
		MercadoLivreRedirectURI:    getEnv("MELI_REDIRECT_URI", ""),
		MercadoLivreWebhookSecret:  getEnv("MELI_WEBHOOK_SECRET", ""),
	}
	cfg.validate()
	return cfg
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		log.Printf("Aviso: %s invalido, usando %d", key, fallback)
		return fallback
	}
	return parsed
}

func getEnvIntAllowZero(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		log.Printf("Aviso: %s invalido, usando %d", key, fallback)
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	return value == "true" || value == "1" || value == "yes"
}

func getEnvList(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			result = append(result, item)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}

func (cfg *Config) validate() {
	adminLoginSet := strings.TrimSpace(cfg.AdminLogin) != ""
	adminPasswordSet := cfg.AdminPassword != ""
	if adminLoginSet != adminPasswordSet {
		log.Fatal("ADM_LOGIN e ADM_PASSWORD devem ser definidos juntos.")
	}
	if adminLoginSet {
		address, err := mail.ParseAddress(strings.TrimSpace(cfg.AdminLogin))
		if err != nil || !strings.EqualFold(address.Address, strings.TrimSpace(cfg.AdminLogin)) {
			log.Fatal("ADM_LOGIN deve ser um e-mail valido.")
		}
	}
	if adminPasswordSet && len(cfg.AdminPassword) < 16 {
		log.Fatal("ADM_PASSWORD fraca. Defina uma senha com pelo menos 16 caracteres.")
	}

	if !cfg.RequireStrongSecrets {
		return
	}

	weakSecrets := map[string]bool{
		"":                            true,
		"change-me-in-production":     true,
		"az3d_default_jwt_secret_key": true,
		"seu_jwt_secret_aqui":         true,
	}
	if len(cfg.JWTSecret) < 32 || weakSecrets[cfg.JWTSecret] {
		log.Fatal("JWT_SECRET fraco. Defina um segredo forte com pelo menos 32 caracteres.")
	}
	if len(cfg.CredentialEncryptionKey) < 32 {
		log.Fatal("CREDENTIAL_ENCRYPTION_KEY fraca. Defina uma chave forte com pelo menos 32 caracteres.")
	}
}
