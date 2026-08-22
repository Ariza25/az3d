package correios

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"az3d-backend/internal/carriers"
)

type Connector struct {
	apiBaseURL   string
	tokenBaseURL string
	credentials  map[string]any
	client       *http.Client
}

func New(apiBaseURL, tokenBaseURL string, credentials map[string]any) *Connector {
	return &Connector{
		apiBaseURL:   strings.TrimRight(firstNonEmpty(apiBaseURL, "https://api.correios.com.br/srorastro"), "/"),
		tokenBaseURL: strings.TrimRight(firstNonEmpty(tokenBaseURL, "https://api.correios.com.br/token"), "/"),
		credentials:  credentials,
		client:       &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Connector) Track(ctx context.Context, trackingCode string) (*carriers.TrackingResult, error) {
	token, err := c.resolveToken(ctx)
	if err != nil {
		return nil, err
	}

	code := strings.TrimSpace(strings.ToUpper(trackingCode))
	if code == "" {
		return nil, fmt.Errorf("codigo de rastreio vazio")
	}

	endpoint := fmt.Sprintf("%s/v1/objetos/%s?resultado=T", c.apiBaseURL, url.PathEscape(code))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	res, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("Correios Rastro HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("resposta Correios invalida: %w", err)
	}

	events := parseEvents(payload)
	return &carriers.TrackingResult{
		Status: inferStatus(events),
		Events: events,
	}, nil
}

func (c *Connector) resolveToken(ctx context.Context) (string, error) {
	if token := stringValue(c.credentials, "access_token", "token", "bearer_token", "correios_token"); token != "" {
		return token, nil
	}

	username := stringValue(c.credentials, "token_username", "username", "login", "id_correios")
	password := stringValue(c.credentials, "token_password", "password", "api_access_code", "codigo_acesso")
	if username == "" || password == "" {
		return "", fmt.Errorf("credenciais Correios ausentes: informe access_token ou usuario/codigo de acesso da API Token")
	}

	authType := strings.ToLower(firstNonEmpty(stringValue(c.credentials, "token_scope", "auth_type"), "user"))
	path := "/v1/autentica"
	body := []byte{}
	if authType == "contract" || authType == "contract_credentials" {
		path = "/v1/autentica/contrato"
		body = mustJSON(map[string]any{
			"numero": stringValue(c.credentials, "contract_number", "contrato", "numero_contrato"),
			"dr":     intValue(c.credentials, "contract_dr", "dr"),
		})
	} else if authType == "posting_card" || authType == "cartao_postagem" {
		path = "/v1/autentica/cartaopostagem"
		body = mustJSON(map[string]any{
			"numero":   stringValue(c.credentials, "posting_card_number", "cartao_postagem", "numero_cartao"),
			"contrato": stringValue(c.credentials, "contract_number", "contrato", "numero_contrato"),
			"dr":       intValue(c.credentials, "contract_dr", "dr"),
		})
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenBaseURL+path, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(username, password)
	req.Header.Set("Accept", "application/json")
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	resBody, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("Correios Token HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(resBody)))
	}

	var payload map[string]any
	if err := json.Unmarshal(resBody, &payload); err != nil {
		return "", fmt.Errorf("resposta Token Correios invalida: %w", err)
	}
	token := stringValue(payload, "token", "access_token", "bearer_token")
	if token == "" {
		return "", fmt.Errorf("Token Correios nao retornou campo token")
	}
	return token, nil
}

func parseEvents(payload map[string]any) []carriers.TrackingEvent {
	object := payload
	if objects, ok := payload["objetos"].([]any); ok && len(objects) > 0 {
		if first, ok := objects[0].(map[string]any); ok {
			object = first
		}
	}

	rawEvents, ok := object["eventos"].([]any)
	if !ok {
		rawEvents, _ = payload["eventos"].([]any)
	}

	events := make([]carriers.TrackingEvent, 0, len(rawEvents))
	for _, raw := range rawEvents {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		event := carriers.TrackingEvent{
			Code:        stringValue(item, "codigo", "codEvento", "tipo", "status"),
			Description: stringValue(item, "descricao", "descricaoEvento", "detalhe", "mensagem"),
			Location:    parseLocation(item),
			OccurredAt:  parseEventTime(item),
		}
		if event.OccurredAt.IsZero() {
			event.OccurredAt = time.Now().UTC()
		}
		events = append(events, event)
	}
	return events
}

func parseLocation(item map[string]any) string {
	parts := []string{}
	if unit, ok := item["unidade"].(map[string]any); ok {
		parts = append(parts, stringValue(unit, "tipo", "nome", "unidade"))
		if address, ok := unit["endereco"].(map[string]any); ok {
			parts = append(parts, stringValue(address, "cidade", "municipio"))
			parts = append(parts, stringValue(address, "uf", "estado"))
		}
	}
	parts = append(parts, stringValue(item, "local", "cidade", "uf"))

	clean := []string{}
	for _, part := range parts {
		if strings.TrimSpace(part) != "" {
			clean = append(clean, strings.TrimSpace(part))
		}
	}
	return strings.Join(clean, " - ")
}

func parseEventTime(item map[string]any) time.Time {
	candidates := []string{
		stringValue(item, "dtHrCriado", "dataHora", "created_at", "ocorridoEm"),
	}
	date := stringValue(item, "data", "dtCriado")
	hour := stringValue(item, "hora", "hrCriado")
	if date != "" && hour != "" {
		candidates = append(candidates, date+" "+hour)
	}
	if date != "" {
		candidates = append(candidates, date)
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
		"2006-01-02",
	}
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		for _, layout := range layouts {
			if parsed, err := time.Parse(layout, candidate); err == nil {
				return parsed.UTC()
			}
		}
	}
	return time.Time{}
}

func inferStatus(events []carriers.TrackingEvent) string {
	if len(events) == 0 {
		return "pending"
	}
	status := "in_transit"
	for _, event := range events {
		text := strings.ToLower(event.Code + " " + event.Description)
		switch {
		case strings.Contains(text, "entreg"):
			return "delivered"
		case strings.Contains(text, "saiu para entrega"):
			status = "out_for_delivery"
		case strings.Contains(text, "aguardando retirada"):
			status = "awaiting_pickup"
		case strings.Contains(text, "postad"):
			status = "posted"
		case strings.Contains(text, "encaminhad") || strings.Contains(text, "recebid"):
			if status == "posted" {
				status = "in_transit"
			}
		}
	}
	return status
}

func stringValue(values map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := values[key]
		if !ok || value == nil {
			continue
		}
		switch typed := value.(type) {
		case string:
			if strings.TrimSpace(typed) != "" {
				return strings.TrimSpace(typed)
			}
		case fmt.Stringer:
			if strings.TrimSpace(typed.String()) != "" {
				return strings.TrimSpace(typed.String())
			}
		case float64:
			return strconv.FormatFloat(typed, 'f', -1, 64)
		}
	}
	return ""
}

func intValue(values map[string]any, keys ...string) int {
	raw := stringValue(values, keys...)
	if raw == "" {
		return 0
	}
	value, _ := strconv.Atoi(raw)
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func mustJSON(value any) []byte {
	raw, _ := json.Marshal(value)
	return raw
}
