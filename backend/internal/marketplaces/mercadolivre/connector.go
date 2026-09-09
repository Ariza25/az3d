package mercadolivre

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	mp "az3d-backend/internal/marketplaces"
)

type Connector struct {
	client *http.Client
}

const (
	catalogPageSize            = 50
	orderPageSize              = 50
	financialEnrichmentWorkers = 5
)

var catalogSearchStatuses = []string{"", "paused", "closed", "pending", "not_yet_active", "inactive"}

// APIError exposes only the HTTP status and operation. Response bodies are
// intentionally omitted because Mercado Livre responses may contain sensitive
// seller or buyer data.
type APIError struct {
	Operation  string
	StatusCode int
}

func (e *APIError) Error() string {
	return fmt.Sprintf("mercado livre %s retornou HTTP %d", e.Operation, e.StatusCode)
}

func IsUnauthorized(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusUnauthorized
}

func IsOrderAccessForbidden(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusForbidden && apiErr.Operation == "/orders/search"
}

func (c *Connector) IsUnauthorized(err error) bool {
	return IsUnauthorized(err)
}

func New() *Connector {
	return &Connector{client: mp.HTTPClient()}
}

func (c *Connector) Provider() string {
	return "mercadolivre"
}

func (c *Connector) postToken(ctx context.Context, form url.Values) (mp.TokenResult, error) {
	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return mp.TokenResult{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := c.client.Do(req)
	if err != nil {
		return mp.TokenResult{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return mp.TokenResult{}, &APIError{Operation: "oauth/token", StatusCode: res.StatusCode}
	}
	var response mercadoTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return mp.TokenResult{}, err
	}
	return mp.TokenResult{
		AccessToken:  response.AccessToken,
		RefreshToken: response.RefreshToken,
		SellerID:     strconv.FormatInt(response.UserID, 10),
		ExpiresIn:    response.ExpiresIn,
		ExpiresAt:    time.Now().Add(time.Duration(response.ExpiresIn) * time.Second),
	}, nil
}

func (c *Connector) getJSON(ctx context.Context, endpoint string, token string, out any) error {
	return c.getJSONWithHeaders(ctx, endpoint, token, nil, out)
}

func (c *Connector) getJSONWithHeaders(ctx context.Context, endpoint string, token string, headers map[string]string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	for name, value := range headers {
		req.Header.Set(name, value)
	}

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		operation := "API"
		if parsed, parseErr := url.Parse(endpoint); parseErr == nil && parsed.Path != "" {
			operation = parsed.Path
		}
		return &APIError{Operation: operation, StatusCode: res.StatusCode}
	}
	if res.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

type mercadoTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	UserID       int64  `json:"user_id"`
}
