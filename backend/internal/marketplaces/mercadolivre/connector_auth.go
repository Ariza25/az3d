package mercadolivre

import (
	"context"
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"

	mp "az3d-backend/internal/marketplaces"
)

func (c *Connector) ExchangeAuthCode(ctx context.Context, account mp.Account, request mp.TokenRequest) (mp.TokenResult, error) {
	clientID, clientSecret := oauthCredentials(account)
	if clientID == "" || clientSecret == "" || strings.TrimSpace(request.Code) == "" || strings.TrimSpace(request.RedirectURI) == "" {
		return mp.TokenResult{}, mp.ErrNotConfigured
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("code", strings.TrimSpace(request.Code))
	form.Set("redirect_uri", strings.TrimSpace(request.RedirectURI))
	if verifier := strings.TrimSpace(request.CodeVerifier); verifier != "" {
		form.Set("code_verifier", verifier)
	}
	return c.postToken(ctx, form)
}

func (c *Connector) RefreshAccessToken(ctx context.Context, account mp.Account) (mp.TokenResult, error) {
	clientID, clientSecret := oauthCredentials(account)
	if clientID == "" || clientSecret == "" || strings.TrimSpace(account.RefreshToken) == "" {
		return mp.TokenResult{}, mp.ErrMissingCredentials
	}
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("refresh_token", strings.TrimSpace(account.RefreshToken))
	return c.postToken(ctx, form)
}

func oauthCredentials(account mp.Account) (string, string) {
	return strings.TrimSpace(account.OAuthClientID), strings.TrimSpace(account.OAuthClientSecret)
}

func (c *Connector) TestConnection(ctx context.Context, account mp.Account) error {
	_, err := c.ResolveAccountIdentity(ctx, account)
	return err
}

func (c *Connector) ResolveAccountIdentity(ctx context.Context, account mp.Account) (mp.AccountIdentity, error) {
	if strings.TrimSpace(account.AccessToken) == "" {
		return mp.AccountIdentity{}, mp.ErrMissingCredentials
	}
	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}
	var response struct {
		ID int64 `json:"id"`
	}
	if err := c.getJSON(ctx, baseURL+"/users/me", account.AccessToken, &response); err != nil {
		return mp.AccountIdentity{}, err
	}
	if response.ID <= 0 {
		return mp.AccountIdentity{}, errors.New("mercado livre /users/me nao retornou o seller do token")
	}
	return mp.AccountIdentity{SellerID: strconv.FormatInt(response.ID, 10)}, nil
}

func (c *Connector) TestOrderAccess(ctx context.Context, account mp.Account) error {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.SellerID) == "" {
		return mp.ErrMissingCredentials
	}
	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}
	endpoint, _ := url.Parse(baseURL + "/orders/search")
	query := endpoint.Query()
	query.Set("seller", strings.TrimSpace(account.SellerID))
	query.Set("limit", "1")
	query.Set("offset", "0")
	endpoint.RawQuery = query.Encode()
	var response mercadoOrdersSearchResponse
	return c.getJSON(ctx, endpoint.String(), account.AccessToken, &response)
}
