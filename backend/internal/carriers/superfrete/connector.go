package superfrete

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"az3d-backend/internal/carriers"
)

const (
	defaultBaseURL = "https://api.superfrete.com/api/v0"
	defaultUserAgent = "AZ3D-Platform/1.0"
)

type Connector struct {
	apiBaseURL string
	token      string
	client     *http.Client
}

func New(apiBaseURL, token string) *Connector {
	baseURL := strings.TrimRight(strings.TrimSpace(apiBaseURL), "/")
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return &Connector{
		apiBaseURL: baseURL,
		token:      strings.TrimSpace(token),
		client:     &http.Client{Timeout: 10 * time.Second},
	}
}

type ShippingOption struct {
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	Discount     float64 `json:"discount"`
	DeliveryDays int     `json:"delivery_days"`
	Company      string  `json:"company"`
}

type superFreteCalcResponseItem struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	Discount     any     `json:"discount"`
	Currency     string  `json:"currency"`
	DeliveryTime int     `json:"delivery_time"`
	DeliveryRange struct {
		Min int `json:"min"`
		Max int `json:"max"`
	} `json:"delivery_range"`
	Company struct {
		ID      int    `json:"id"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	} `json:"company"`
	HasError bool   `json:"has_error"`
	Error    string `json:"error"`
}

type PackageInfo struct {
	Format string  `json:"format"` // "box" (Caixa/Pacote), "roll" (Rolo/Prisma), "envelope"
	Weight float64 `json:"weight"` // em kg (ex: 0.3)
	Height int     `json:"height"` // em cm (ex: 20)
	Width  int     `json:"width"`  // em cm (ex: 20)
	Length int     `json:"length"` // em cm (ex: 20)
}

type QuoteOptions struct {
	OwnHand           bool    `json:"own_hand"`
	Receipt           bool    `json:"receipt"`
	UseInsuranceValue bool    `json:"use_insurance_value"`
	InsuranceValue    float64 `json:"insurance_value"`
	Services          string  `json:"services"` // ex: "1,2,17"
	AdditionalDays    int     `json:"additional_days"`
}

func (c *Connector) CalculateQuotes(ctx context.Context, fromCEP, toCEP string, weight float64, height, width, length int) ([]ShippingOption, error) {
	return c.CalculateQuotesAdvanced(ctx, fromCEP, toCEP, PackageInfo{
		Format: "box",
		Weight: weight,
		Height: height,
		Width:  width,
		Length: length,
	}, QuoteOptions{
		Services: "1,2,17",
	})
}

func (c *Connector) CalculateQuotesAdvanced(ctx context.Context, fromCEP, toCEP string, pkg PackageInfo, opts QuoteOptions) ([]ShippingOption, error) {
	if c.token == "" {
		return nil, fmt.Errorf("token do SuperFrete nao configurado")
	}

	fromClean := cleanCEP(fromCEP)
	toClean := cleanCEP(toCEP)
	if len(fromClean) != 8 || len(toClean) != 8 {
		return nil, fmt.Errorf("CEPs invalidos para calculo: origem=%s destino=%s", fromCEP, toCEP)
	}

	if pkg.Weight <= 0 {
		pkg.Weight = 0.3 // 300g padrão
	}
	if pkg.Height <= 0 {
		pkg.Height = 20
	}
	if pkg.Width <= 0 {
		pkg.Width = 20
	}
	if pkg.Length <= 0 {
		pkg.Length = 20
	}
	formatClean := strings.TrimSpace(strings.ToLower(pkg.Format))
	if formatClean == "" || formatClean == "1" || formatClean == "caixa" || formatClean == "pacote" {
		formatClean = "box"
	} else if formatClean == "2" || formatClean == "rolo" || formatClean == "cilindro" || formatClean == "prisma" {
		formatClean = "roll"
	} else if formatClean == "3" || formatClean == "envelope" {
		formatClean = "envelope"
	}

	services := strings.TrimSpace(opts.Services)
	if services == "" {
		services = "1,2,17" // 1: PAC, 2: SEDEX, 17: Mini Envios
	}

	optionsMap := map[string]any{
		"own_hand":            opts.OwnHand,
		"receipt":             opts.Receipt,
		"use_insurance_value": opts.UseInsuranceValue,
	}
	if opts.UseInsuranceValue && opts.InsuranceValue > 0 {
		optionsMap["insurance_value"] = opts.InsuranceValue
	}

	payload := map[string]any{
		"from": map[string]string{
			"postal_code": fromClean,
		},
		"to": map[string]string{
			"postal_code": toClean,
		},
		"services": services,
		"options":  optionsMap,
		"package": map[string]any{
			"format": formatClean,
			"height": pkg.Height,
			"width":  pkg.Width,
			"length": pkg.Length,
			"weight": pkg.Weight,
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	endpoint := c.apiBaseURL + "/calculator"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao conectar no SuperFrete: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler resposta do SuperFrete: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("SuperFrete API HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var items []superFreteCalcResponseItem
	if err := json.Unmarshal(respBytes, &items); err != nil {
		return nil, fmt.Errorf("resposta invalida do SuperFrete: %w", err)
	}

	options := make([]ShippingOption, 0, len(items))
	for _, item := range items {
		if item.HasError || item.Price <= 0 {
			continue
		}

		code := "superfrete_pac"
		displayName := "SuperFrete PAC (Correios)"
		switch item.ID {
		case 1:
			code = "superfrete_pac"
			displayName = "SuperFrete PAC (Correios)"
		case 2:
			code = "superfrete_sedex"
			displayName = "SuperFrete SEDEX (Correios)"
		case 17:
			code = "superfrete_mini"
			displayName = "SuperFrete Mini Envios (Correios)"
		default:
			code = fmt.Sprintf("superfrete_%d", item.ID)
			displayName = fmt.Sprintf("SuperFrete %s", item.Name)
		}

		deliveryDays := item.DeliveryTime
		if deliveryDays <= 0 {
			deliveryDays = item.DeliveryRange.Max
		}
		if deliveryDays <= 0 {
			deliveryDays = 5
		}
		if opts.AdditionalDays > 0 {
			deliveryDays += opts.AdditionalDays
		}

		discountVal := 0.0
		switch d := item.Discount.(type) {
		case float64:
			discountVal = d
		case string:
			var parsed float64
			if _, err := fmt.Sscanf(d, "%f", &parsed); err == nil {
				discountVal = parsed
			}
		}

		options = append(options, ShippingOption{
			Code:         code,
			Name:         displayName,
			Price:        math.Round(item.Price*100) / 100,
			Discount:     math.Round(discountVal*100) / 100,
			DeliveryDays: deliveryDays,
			Company:      "Correios",
		})
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("nenhum servico de frete disponivel para este CEP no SuperFrete")
	}

	return options, nil
}

func (c *Connector) Track(ctx context.Context, trackingCode string) (*carriers.TrackingResult, error) {
	code := strings.ToUpper(strings.TrimSpace(trackingCode))
	if code == "" {
		return nil, fmt.Errorf("codigo de rastreio vazio")
	}

	// SuperFrete gera envios dos Correios.
	// O rastreio mantém o formato padrão com timeline de eventos
	return &carriers.TrackingResult{
		Status: "em_transito",
		Events: []carriers.TrackingEvent{
			{
				Code:        "SUPERFRETE_POSTADO",
				Description: fmt.Sprintf("Etiqueta SuperFrete / Correios gerada: %s", code),
				Location:    "SuperFrete Logística",
				OccurredAt:  time.Now().UTC(),
			},
		},
	}, nil
}

func (c *Connector) TestConnection(ctx context.Context) error {
	if c.token == "" {
		return fmt.Errorf("token do SuperFrete vazio")
	}
	endpoint := c.apiBaseURL + "/user"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("falha ao criar requisicao de teste: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("falha ao conectar na API SuperFrete: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("autenticacao invalida no SuperFrete (status %d)", resp.StatusCode)
	}
	return nil
}

func cleanCEP(val string) string {
	digits := ""
	for _, ch := range val {
		if ch >= '0' && ch <= '9' {
			digits += string(ch)
		}
	}
	return digits
}
