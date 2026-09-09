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

	mp "az3d-backend/internal/marketplaces"
)

func (c *Connector) FetchCatalog(ctx context.Context, account mp.Account) (mp.CatalogSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.SellerID) == "" {
		return mp.CatalogSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}

	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	itemIDs, err := c.fetchItemIDs(ctx, baseURL, account)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}
	items, err := c.fetchItems(ctx, baseURL, account.AccessToken, itemIDs)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}

	return mp.CatalogSyncResult{
		Provider: c.Provider(),
		Items:    items,
		Message:  fmt.Sprintf("%d anuncio(s) encontrados no Mercado Livre", len(items)),
	}, nil
}

func (c *Connector) FetchCatalogItems(ctx context.Context, account mp.Account, externalItemIDs []string) (mp.CatalogSyncResult, error) {
	if strings.TrimSpace(account.AccessToken) == "" || strings.TrimSpace(account.SellerID) == "" {
		return mp.CatalogSyncResult{Provider: c.Provider()}, mp.ErrMissingCredentials
	}

	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	itemIDs := uniqueItemIDs(externalItemIDs)
	items, err := c.fetchItems(ctx, baseURL, account.AccessToken, itemIDs)
	if err != nil {
		return mp.CatalogSyncResult{Provider: c.Provider()}, err
	}

	owned := make([]mp.CatalogItem, 0, len(items))
	for _, item := range items {
		sellerID, _ := item.Raw["seller_id"].(string)
		sellerID = strings.TrimSpace(sellerID)
		if sellerID != "" && sellerID != "0" && sellerID != strings.TrimSpace(account.SellerID) {
			continue
		}
		owned = append(owned, item)
	}

	return mp.CatalogSyncResult{
		Provider: c.Provider(),
		Items:    owned,
		Message:  fmt.Sprintf("%d anuncio(s) encontrado(s) por notificacao no Mercado Livre", len(owned)),
	}, nil
}

func uniqueItemIDs(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func (c *Connector) fetchItemIDs(ctx context.Context, baseURL string, account mp.Account) ([]string, error) {
	itemIDs := make([]string, 0, catalogPageSize)
	seen := make(map[string]struct{})
	for _, status := range catalogSearchStatuses {
		statusItemIDs, err := c.fetchItemIDsByStatus(ctx, baseURL, account, status)
		if err != nil {
			var apiErr *APIError
			if status != "" && errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusBadRequest {
				continue
			}
			return nil, err
		}
		for _, itemID := range statusItemIDs {
			if _, exists := seen[itemID]; exists {
				continue
			}
			seen[itemID] = struct{}{}
			itemIDs = append(itemIDs, itemID)
		}
	}
	return itemIDs, nil
}

func (c *Connector) fetchItemIDsByStatus(ctx context.Context, baseURL string, account mp.Account, status string) ([]string, error) {
	itemIDs := make([]string, 0, catalogPageSize)
	for offset := 0; ; {
		endpoint, _ := url.Parse(baseURL + "/users/" + url.PathEscape(account.SellerID) + "/items/search")
		query := endpoint.Query()
		query.Set("limit", strconv.Itoa(catalogPageSize))
		query.Set("offset", strconv.Itoa(offset))
		if status != "" {
			query.Set("status", status)
		}
		endpoint.RawQuery = query.Encode()

		var response struct {
			Paging struct {
				Total int `json:"total"`
			} `json:"paging"`
			Results []string `json:"results"`
		}
		if err := c.getJSON(ctx, endpoint.String(), account.AccessToken, &response); err != nil {
			return nil, err
		}

		for _, itemID := range response.Results {
			itemID = strings.TrimSpace(itemID)
			if itemID == "" {
				continue
			}
			itemIDs = append(itemIDs, itemID)
		}

		pageCount := len(response.Results)
		offset += pageCount
		if pageCount == 0 || (response.Paging.Total > 0 && offset >= response.Paging.Total) {
			break
		}
		if response.Paging.Total == 0 && pageCount < catalogPageSize {
			break
		}
	}
	return itemIDs, nil
}

func (c *Connector) fetchItems(ctx context.Context, baseURL string, token string, itemIDs []string) ([]mp.CatalogItem, error) {
	items := []mp.CatalogItem{}
	for start := 0; start < len(itemIDs); start += 20 {
		end := start + 20
		if end > len(itemIDs) {
			end = len(itemIDs)
		}

		endpoint, _ := url.Parse(baseURL + "/items/bulk")
		query := endpoint.Query()
		query.Set("ids", strings.Join(itemIDs[start:end], ","))
		endpoint.RawQuery = query.Encode()

		var response []struct {
			StatusCode int         `json:"status_code"`
			Body       mercadoItem `json:"body"`
		}
		if err := c.getJSON(ctx, endpoint.String(), token, &response); err != nil {
			return nil, err
		}
		added := 0
		statusCounts := make(map[int]int)
		missingBodyID := 0
		for _, entry := range response {
			statusCounts[entry.StatusCode]++
			if entry.StatusCode >= 300 {
				continue
			}
			if entry.Body.ID == "" {
				missingBodyID++
				continue
			}
			items = append(items, normalizeItem(entry.Body))
			added++
		}
		if len(response) > 0 && added == 0 {
			return nil, fmt.Errorf("items/bulk nao retornou corpos utilizaveis: respostas=%d status=%v sem_body_id=%d", len(response), statusCounts, missingBodyID)
		}
	}
	if len(items) == 0 && len(itemIDs) > 0 {
		for start := 0; start < len(itemIDs); start += 20 {
			end := start + 20
			if end > len(itemIDs) {
				end = len(itemIDs)
			}
			endpoint, _ := url.Parse(baseURL + "/items")
			query := endpoint.Query()
			query.Set("ids", strings.Join(itemIDs[start:end], ","))
			endpoint.RawQuery = query.Encode()
			var response []struct {
				Code       int         `json:"code"`
				StatusCode int         `json:"status_code"`
				Body       mercadoItem `json:"body"`
			}
			if err := c.getJSON(ctx, endpoint.String(), token, &response); err != nil {
				var apiErr *APIError
				if errors.As(err, &apiErr) && (apiErr.StatusCode == http.StatusForbidden || apiErr.StatusCode == http.StatusNotFound) {
					break
				}
				return nil, err
			}
			for _, entry := range response {
				statusCode := entry.StatusCode
				if statusCode == 0 {
					statusCode = entry.Code
				}
				if statusCode >= 300 || entry.Body.ID == "" {
					continue
				}
				items = append(items, normalizeItem(entry.Body))
			}
		}
	}
	if len(items) == 0 && len(itemIDs) > 0 {
		individualStatusCounts := make(map[int]int)
		for _, itemID := range itemIDs {
			var item mercadoItem
			endpoint := baseURL + "/items/" + url.PathEscape(itemID)
			if err := c.getJSON(ctx, endpoint, token, &item); err != nil {
				var apiErr *APIError
				if errors.As(err, &apiErr) && (apiErr.StatusCode == http.StatusForbidden || apiErr.StatusCode == http.StatusNotFound) {
					individualStatusCounts[apiErr.StatusCode]++
					continue
				}
				return nil, err
			}
			if item.ID != "" {
				items = append(items, normalizeItem(item))
			}
		}
		if len(items) == 0 && len(individualStatusCounts) > 0 {
			return nil, fmt.Errorf("itens conhecidos indisponiveis na consulta autenticada: status=%v", individualStatusCounts)
		}
	}
	return items, nil
}

type mercadoItem struct {
	ID                string             `json:"id"`
	SellerID          int64              `json:"seller_id"`
	Title             string             `json:"title"`
	Price             float64            `json:"price"`
	AvailableQuantity int                `json:"available_quantity"`
	Thumbnail         string             `json:"thumbnail"`
	Pictures          []mercadoPicture   `json:"pictures"`
	Permalink         string             `json:"permalink"`
	SellerCustomField string             `json:"seller_custom_field"`
	Attributes        []mercadoAttribute `json:"attributes"`
	Variations        []mercadoVariation `json:"variations"`
	Status            string             `json:"status"`
}

type mercadoPicture struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	SecureURL string `json:"secure_url"`
}

type mercadoAttribute struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ValueName string `json:"value_name"`
}

type mercadoVariation struct {
	ID                    int64              `json:"id"`
	Price                 float64            `json:"price"`
	AvailableQuantity     int                `json:"available_quantity"`
	SellerCustomField     string             `json:"seller_custom_field"`
	AttributeCombinations []mercadoAttribute `json:"attribute_combinations"`
	Attributes            []mercadoAttribute `json:"attributes"`
	PictureIDs            []string           `json:"picture_ids"`
}

func normalizeItem(item mercadoItem) mp.CatalogItem {
	imageURL := item.Thumbnail
	if len(item.Pictures) > 0 {
		imageURL = item.Pictures[0].SecureURL
		if imageURL == "" {
			imageURL = item.Pictures[0].URL
		}
	}
	sku := strings.TrimSpace(item.SellerCustomField)
	material := ""
	for _, attr := range item.Attributes {
		switch strings.ToUpper(attr.ID) {
		case "SELLER_SKU":
			if sku == "" {
				sku = strings.TrimSpace(attr.ValueName)
			}
		case "MATERIAL":
			material = attr.ValueName
		}
	}
	status := "active"
	if item.Status != "active" {
		status = "paused"
	}

	variants, colorStocks, colorImages := normalizeVariations(item, imageURL, status == "active")
	stockQty := maxInt(item.AvailableQuantity, 0)
	if len(variants) > 0 {
		stockQty = 0
		for _, stock := range colorStocks {
			stockQty += maxInt(stock.StockQty, 0)
		}
	} else {
		colorName := marketplaceListingColor(item.Title, sku)
		colorImages = listingPictures(item.Pictures, colorName, imageURL)
		colorStocks = []mp.CatalogColorStock{{ColorName: colorName, StockQty: stockQty}}
	}
	if len(colorImages) == 0 {
		colorImages = []mp.CatalogColorImage{{ColorName: "Padrao", ImageURL: imageURL, SortOrder: 0}}
	}
	if len(colorStocks) == 0 {
		colorStocks = []mp.CatalogColorStock{{ColorName: "Padrao", StockQty: stockQty}}
	}

	return mp.CatalogItem{
		ExternalItemID: item.ID,
		ExternalSKU:    sku,
		ExternalTitle:  item.Title,
		ExternalURL:    item.Permalink,
		Title:          item.Title,
		Description:    item.Title,
		Price:          item.Price,
		ImageURL:       imageURL,
		Material:       material,
		StockQty:       stockQty,
		Status:         status,
		ColorImages:    colorImages,
		ColorStocks:    colorStocks,
		Variants:       variants,
		Raw: map[string]any{
			"available_quantity": strconv.Itoa(item.AvailableQuantity),
			"seller_id":          strconv.FormatInt(item.SellerID, 10),
		},
	}
}

func listingPictures(pictures []mercadoPicture, colorName string, fallbackImageURL string) []mp.CatalogColorImage {
	images := make([]mp.CatalogColorImage, 0, len(pictures))
	seen := map[string]struct{}{}
	for _, picture := range pictures {
		pictureURL := strings.TrimSpace(picture.SecureURL)
		if pictureURL == "" {
			pictureURL = strings.TrimSpace(picture.URL)
		}
		if pictureURL == "" {
			continue
		}
		if _, exists := seen[pictureURL]; exists {
			continue
		}
		seen[pictureURL] = struct{}{}
		images = append(images, mp.CatalogColorImage{ColorName: colorName, ImageURL: pictureURL, SortOrder: len(images)})
	}
	if len(images) == 0 && strings.TrimSpace(fallbackImageURL) != "" {
		images = append(images, mp.CatalogColorImage{ColorName: colorName, ImageURL: strings.TrimSpace(fallbackImageURL), SortOrder: 0})
	}
	return images
}

func marketplaceListingColor(title string, sku string) string {
	colors := []string{"Branco", "Preto", "Cinza", "Bege", "Vermelho", "Azul", "Verde", "Amarelo", "Rosa", "Roxo", "Laranja", "Marrom", "Natural", "Dourado", "Prata"}
	words := strings.Fields(strings.TrimSpace(title))
	if len(words) > 0 {
		last := strings.Trim(words[len(words)-1], " .,-_/()")
		for _, color := range colors {
			if strings.EqualFold(last, color) {
				return color
			}
		}
	}

	parts := strings.FieldsFunc(strings.ToUpper(strings.TrimSpace(sku)), func(r rune) bool { return r == '-' || r == '_' })
	if len(parts) > 0 {
		aliases := map[string]string{
			"BRA": "Branco", "BR": "Branco", "PRE": "Preto", "PT": "Preto", "CIN": "Cinza", "CZ": "Cinza",
			"BEG": "Bege", "BG": "Bege", "VER": "Vermelho", "VM": "Vermelho", "AZU": "Azul", "AZ": "Azul",
			"VRD": "Verde", "VD": "Verde", "AMA": "Amarelo", "AM": "Amarelo", "ROS": "Rosa", "RX": "Roxo",
		}
		if color := aliases[parts[len(parts)-1]]; color != "" {
			return color
		}
	}
	return "Padrao"
}

func normalizeVariations(item mercadoItem, fallbackImageURL string, active bool) ([]mp.CatalogVariant, []mp.CatalogColorStock, []mp.CatalogColorImage) {
	variants := make([]mp.CatalogVariant, 0, len(item.Variations))
	stocks := make([]mp.CatalogColorStock, 0, len(item.Variations))
	images := make([]mp.CatalogColorImage, 0, len(item.Variations))
	pictures := make(map[string]string, len(item.Pictures))
	for _, picture := range item.Pictures {
		pictureURL := strings.TrimSpace(picture.SecureURL)
		if pictureURL == "" {
			pictureURL = strings.TrimSpace(picture.URL)
		}
		if picture.ID != "" && pictureURL != "" {
			pictures[picture.ID] = pictureURL
		}
	}

	for index, variation := range item.Variations {
		name := variationName(variation, index)
		price := variation.Price
		if price <= 0 {
			price = item.Price
		}
		material := attributeValue(variation.Attributes, "MATERIAL")
		if material == "" {
			material = attributeValue(variation.AttributeCombinations, "MATERIAL")
		}
		variants = append(variants, mp.CatalogVariant{
			ColorName:     name,
			VariationName: name,
			Attributes:    variationAttributesJSON(variation.AttributeCombinations),
			Price:         price,
			Material:      material,
			IsActive:      active,
			SortOrder:     index,
		})
		stocks = append(stocks, mp.CatalogColorStock{ColorName: name, StockQty: maxInt(variation.AvailableQuantity, 0)})

		variationImageURLs := make([]string, 0, len(variation.PictureIDs))
		for _, pictureID := range variation.PictureIDs {
			if pictureURL := pictures[pictureID]; pictureURL != "" {
				variationImageURLs = append(variationImageURLs, pictureURL)
			}
		}
		if len(variationImageURLs) == 0 && fallbackImageURL != "" {
			variationImageURLs = append(variationImageURLs, fallbackImageURL)
		}
		for pictureIndex, variationImageURL := range variationImageURLs {
			images = append(images, mp.CatalogColorImage{ColorName: name, ImageURL: variationImageURL, SortOrder: index*100 + pictureIndex})
		}
	}
	return variants, stocks, images
}

func variationAttributesJSON(attributes []mercadoAttribute) string {
	values := make([]map[string]string, 0, len(attributes))
	for _, attribute := range attributes {
		name := strings.TrimSpace(attribute.Name)
		if name == "" {
			name = strings.TrimSpace(attribute.ID)
		}
		value := strings.TrimSpace(attribute.ValueName)
		if name != "" && value != "" {
			values = append(values, map[string]string{"name": name, "value": value})
		}
	}
	payload, err := json.Marshal(values)
	if err != nil {
		return "[]"
	}
	return string(payload)
}

func variationName(variation mercadoVariation, index int) string {
	parts := make([]string, 0, len(variation.AttributeCombinations))
	for _, attribute := range variation.AttributeCombinations {
		if value := strings.TrimSpace(attribute.ValueName); value != "" {
			parts = append(parts, value)
		}
	}
	if len(parts) > 0 {
		return strings.Join(parts, " / ")
	}
	if variation.ID != 0 {
		return strconv.FormatInt(variation.ID, 10)
	}
	return fmt.Sprintf("Variacao %d", index+1)
}

func attributeValue(attributes []mercadoAttribute, id string) string {
	for _, attribute := range attributes {
		if strings.EqualFold(strings.TrimSpace(attribute.ID), id) {
			return strings.TrimSpace(attribute.ValueName)
		}
	}
	return ""
}
