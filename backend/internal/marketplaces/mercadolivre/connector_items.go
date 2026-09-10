package mercadolivre

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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
	missingIDs := []string{}

	for start := 0; start < len(itemIDs); start += 20 {
		end := start + 20
		if end > len(itemIDs) {
			end = len(itemIDs)
		}
		chunk := itemIDs[start:end]

		// 1. Tentar rota /items/bulk (usada em mocks e compatibilidade de testes)
		endpointBulk, _ := url.Parse(baseURL + "/items/bulk")
		queryBulk := endpointBulk.Query()
		queryBulk.Set("ids", strings.Join(chunk, ","))
		endpointBulk.RawQuery = queryBulk.Encode()

		var responseBulk []struct {
			Code       int         `json:"code"`
			StatusCode int         `json:"status_code"`
			Body       mercadoItem `json:"body"`
		}
		errBulk := c.getJSON(ctx, endpointBulk.String(), token, &responseBulk)
		if errBulk == nil && len(responseBulk) > 0 {
			receivedIDs := make(map[string]struct{})
			for _, entry := range responseBulk {
				statusCode := entry.StatusCode
				if statusCode == 0 {
					statusCode = entry.Code
				}
				if statusCode >= 300 || entry.Body.ID == "" {
					continue
				}
				receivedIDs[entry.Body.ID] = struct{}{}
				items = append(items, normalizeItem(entry.Body))
			}
			for _, id := range chunk {
				if _, ok := receivedIDs[id]; !ok {
					missingIDs = append(missingIDs, id)
				}
			}
			continue
		}

		// 2. Rota multiget oficial do Mercado Livre: /items?ids=MLB1,MLB2,...
		endpoint, _ := url.Parse(baseURL + "/items")
		query := endpoint.Query()
		query.Set("ids", strings.Join(chunk, ","))
		endpoint.RawQuery = query.Encode()

		var response []struct {
			Code       int         `json:"code"`
			StatusCode int         `json:"status_code"`
			Body       mercadoItem `json:"body"`
		}
		if err := c.getJSON(ctx, endpoint.String(), token, &response); err != nil {
			log.Printf("[mercadolivre] multiget falhou para %d itens: %v. Tentando busca individual.", len(chunk), err)
			missingIDs = append(missingIDs, chunk...)
			continue
		}

		receivedIDs := make(map[string]struct{})
		for _, entry := range response {
			statusCode := entry.StatusCode
			if statusCode == 0 {
				statusCode = entry.Code
			}
			if statusCode >= 300 || entry.Body.ID == "" {
				continue
			}
			receivedIDs[entry.Body.ID] = struct{}{}

			// Se o multiget retornar sem galeria completa (<= 1 foto) ou sem video, enriquece buscando o item direto
			itemBody := entry.Body
			videoURL := resolveMercadoLivreVideoURL(itemBody.VideoID, itemBody.Videos)
			if (len(itemBody.Pictures) <= 1 || videoURL == "") && itemBody.ID != "" {
				var detailedItem mercadoItem
				detailedEndpoint := baseURL + "/items/" + url.PathEscape(itemBody.ID)
				if err := c.getJSON(ctx, detailedEndpoint, token, &detailedItem); err == nil && detailedItem.ID != "" {
					if len(detailedItem.Pictures) > len(itemBody.Pictures) {
						itemBody.Pictures = detailedItem.Pictures
					}
					if detailedItem.Videos != nil {
						itemBody.Videos = detailedItem.Videos
					}
					if detailedItem.VideoID != nil {
						itemBody.VideoID = detailedItem.VideoID
					}
					if len(detailedItem.Variations) > 0 {
						itemBody.Variations = detailedItem.Variations
					}
				}
			}

			items = append(items, normalizeItem(itemBody))
		}

		for _, id := range chunk {
			if _, ok := receivedIDs[id]; !ok {
				missingIDs = append(missingIDs, id)
			}
		}
	}

	// Para IDs que não foram retornados no lote, busca individualmente
	if len(missingIDs) > 0 {
		for _, itemID := range missingIDs {
			var item mercadoItem
			endpoint := baseURL + "/items/" + url.PathEscape(itemID)
			if err := c.getJSON(ctx, endpoint, token, &item); err == nil && item.ID != "" {
				items = append(items, normalizeItem(item))
			} else if err != nil {
				log.Printf("[mercadolivre] busca individual do item %s falhou: %v", itemID, err)
			}
		}
	}

	return items, nil
}

type mercadoItem struct {
	ID                string             `json:"id"`
	SellerID          any                `json:"seller_id"`
	Title             string             `json:"title"`
	Price             float64            `json:"price"`
	AvailableQuantity int                `json:"available_quantity"`
	Thumbnail         string             `json:"thumbnail"`
	Pictures          []mercadoPicture   `json:"pictures"`
	Permalink         string             `json:"permalink"`
	SellerCustomField any                `json:"seller_custom_field"`
	Attributes        []mercadoAttribute `json:"attributes"`
	Variations        []mercadoVariation `json:"variations"`
	Status            string             `json:"status"`
	VideoID           any                `json:"video_id"`
	Videos            any                `json:"videos"`
}

type mercadoPicture struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	SecureURL string `json:"secure_url"`
}

type mercadoAttribute struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ValueName any    `json:"value_name"`
}

type mercadoVariation struct {
	ID                    any                `json:"id"`
	Price                 float64            `json:"price"`
	AvailableQuantity     int                `json:"available_quantity"`
	SellerCustomField     any                `json:"seller_custom_field"`
	AttributeCombinations []mercadoAttribute `json:"attribute_combinations"`
	Attributes            []mercadoAttribute `json:"attributes"`
	PictureIDs            []string           `json:"picture_ids"`
}

func stringify(val any) string {
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		return strconv.FormatInt(int64(v), 10)
	case int64:
		return strconv.FormatInt(v, 10)
	case int:
		return strconv.Itoa(v)
	case json.Number:
		return v.String()
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", v))
	}
}

func resolveMercadoLivreVideoURL(videoID any, videos any) string {
	// 1. Procurar URLs de vídeo diretas no payload de vídeos
	if videos != nil {
		switch vList := videos.(type) {
		case []any:
			for _, v := range vList {
				if u := extractVideoURL(v); u != "" {
					return u
				}
			}
		case map[string]any:
			if u := extractVideoURL(vList); u != "" {
				return u
			}
		case string:
			if u := strings.TrimSpace(vList); strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
				return u
			}
		}
	}

	// 2. Tratar videoID
	vID := stringify(videoID)
	if vID != "" {
		if strings.HasPrefix(vID, "http://") || strings.HasPrefix(vID, "https://") {
			return vID
		}
		// IDs do YouTube possuem 11 caracteres alfanuméricos
		if len(vID) == 11 && isValidYouTubeID(vID) {
			return fmt.Sprintf("https://www.youtube.com/watch?v=%s", vID)
		}
	}

	return ""
}

func extractVideoURL(val any) string {
	switch v := val.(type) {
	case string:
		s := strings.TrimSpace(v)
		if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
			return s
		}
	case map[string]any:
		for _, key := range []string{"url", "stream_url", "secure_url", "source", "download_url"} {
			if u, ok := v[key].(string); ok {
				u = strings.TrimSpace(u)
				if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
					return u
				}
			}
		}
		if mediaType, ok := v["type"].(string); ok && strings.EqualFold(mediaType, "youtube") {
			if id := stringify(v["id"]); id != "" {
				return fmt.Sprintf("https://www.youtube.com/watch?v=%s", id)
			}
		}
	}
	return ""
}

func isValidYouTubeID(id string) bool {
	for _, r := range id {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-') {
			return false
		}
	}
	return true
}

func normalizeItem(item mercadoItem) mp.CatalogItem {
	imageURL := item.Thumbnail
	if len(item.Pictures) > 0 {
		imageURL = item.Pictures[0].SecureURL
		if imageURL == "" {
			imageURL = item.Pictures[0].URL
		}
	}
	sku := stringify(item.SellerCustomField)
	material := ""
	for _, attr := range item.Attributes {
		attrVal := stringify(attr.ValueName)
		switch strings.ToUpper(attr.ID) {
		case "SELLER_SKU":
			if sku == "" {
				sku = attrVal
			}
		case "MATERIAL":
			material = attrVal
		}
	}
	status := "active"
	if item.Status != "active" {
		status = "paused"
	}

	videoURL := resolveMercadoLivreVideoURL(item.VideoID, item.Videos)

	variants, colorStocks, colorImages := normalizeVariations(item, imageURL, videoURL, status == "active")
	stockQty := maxInt(item.AvailableQuantity, 0)
	if len(variants) > 0 {
		stockQty = 0
		for _, stock := range colorStocks {
			stockQty += maxInt(stock.StockQty, 0)
		}
	} else {
		colorName := marketplaceListingColor(item.Title, sku, item.Attributes)
		colorImages = listingPictures(item.Pictures, colorName, imageURL, videoURL)
		colorStocks = []mp.CatalogColorStock{{ColorName: colorName, StockQty: stockQty}}
	}
	if len(colorImages) == 0 {
		colorImages = []mp.CatalogColorImage{{ColorName: "Padrao", ImageURL: imageURL, VideoURL: videoURL, SortOrder: 0}}
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
		VideoURL:       videoURL,
		Material:       material,
		StockQty:       stockQty,
		Status:         status,
		ColorImages:    colorImages,
		ColorStocks:    colorStocks,
		Variants:       variants,
		Raw: map[string]any{
			"available_quantity": strconv.Itoa(item.AvailableQuantity),
			"seller_id":          stringify(item.SellerID),
		},
	}
}

func listingPictures(pictures []mercadoPicture, colorName string, fallbackImageURL string, videoURL string) []mp.CatalogColorImage {
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
		images = append(images, mp.CatalogColorImage{ColorName: colorName, ImageURL: pictureURL, VideoURL: videoURL, SortOrder: len(images)})
	}
	if len(images) == 0 && strings.TrimSpace(fallbackImageURL) != "" {
		images = append(images, mp.CatalogColorImage{ColorName: colorName, ImageURL: strings.TrimSpace(fallbackImageURL), VideoURL: videoURL, SortOrder: 0})
	}
	return images
}

func marketplaceListingColor(title string, sku string, attributes []mercadoAttribute) string {
	colors := []string{"Branco", "Preto", "Cinza", "Bege", "Vermelho", "Azul", "Verde", "Amarelo", "Rosa", "Roxo", "Laranja", "Marrom", "Natural", "Dourado", "Prata"}

	// 1. Atributos da API
	for _, attr := range attributes {
		id := strings.ToUpper(strings.TrimSpace(attr.ID))
		if id == "COLOR" || id == "MAIN_COLOR" || id == "COR" || id == "COR_PRINCIPAL" {
			if val := stringify(attr.ValueName); val != "" {
				for _, color := range colors {
					if strings.EqualFold(val, color) {
						return color
					}
				}
				return val
			}
		}
	}

	// 2. Título do anúncio
	words := strings.Fields(strings.TrimSpace(title))
	if len(words) > 0 {
		last := strings.Trim(words[len(words)-1], " .,-_/()")
		for _, color := range colors {
			if strings.EqualFold(last, color) {
				return color
			}
		}
		for _, w := range words {
			clean := strings.Trim(w, " .,-_/()")
			for _, color := range colors {
				if strings.EqualFold(clean, color) {
					return color
				}
			}
		}
	}

	// 3. SKU
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

func normalizeVariations(item mercadoItem, fallbackImageURL string, videoURL string, active bool) ([]mp.CatalogVariant, []mp.CatalogColorStock, []mp.CatalogColorImage) {
	variants := make([]mp.CatalogVariant, 0, len(item.Variations))
	stocks := make([]mp.CatalogColorStock, 0, len(item.Variations))
	images := make([]mp.CatalogColorImage, 0, len(item.Variations))
	pictures := make(map[string]string, len(item.Pictures))
	allPictureURLs := make([]string, 0, len(item.Pictures))
	variationAssignedPicIDs := make(map[string]struct{})

	for _, picture := range item.Pictures {
		pictureURL := strings.TrimSpace(picture.SecureURL)
		if pictureURL == "" {
			pictureURL = strings.TrimSpace(picture.URL)
		}
		if picture.ID != "" && pictureURL != "" {
			pictures[picture.ID] = pictureURL
			allPictureURLs = append(allPictureURLs, pictureURL)
		}
	}

	for _, variation := range item.Variations {
		for _, picID := range variation.PictureIDs {
			variationAssignedPicIDs[picID] = struct{}{}
		}
	}

	// Fotos gerais do anúncio pai que não foram atribuídas com exclusividade a uma variação específica
	generalPictureURLs := make([]string, 0)
	for _, picture := range item.Pictures {
		if _, assigned := variationAssignedPicIDs[picture.ID]; !assigned {
			pictureURL := strings.TrimSpace(picture.SecureURL)
			if pictureURL == "" {
				pictureURL = strings.TrimSpace(picture.URL)
			}
			if pictureURL != "" {
				generalPictureURLs = append(generalPictureURLs, pictureURL)
			}
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

		variationImageURLs := make([]string, 0, len(variation.PictureIDs)+len(generalPictureURLs))
		seenVariationURLs := make(map[string]struct{})

		// 1. Fotos específicas desta variação/cor
		for _, pictureID := range variation.PictureIDs {
			if pictureURL := pictures[pictureID]; pictureURL != "" {
				if _, exists := seenVariationURLs[pictureURL]; !exists {
					seenVariationURLs[pictureURL] = struct{}{}
					variationImageURLs = append(variationImageURLs, pictureURL)
				}
			}
		}

		// 2. Fotos gerais do anúncio pai (contexto, medidas, detalhes compartilhados)
		for _, generalURL := range generalPictureURLs {
			if _, exists := seenVariationURLs[generalURL]; !exists {
				seenVariationURLs[generalURL] = struct{}{}
				variationImageURLs = append(variationImageURLs, generalURL)
			}
		}

		// 3. Fallback se a variação não teve nenhuma foto vinculada
		if len(variationImageURLs) == 0 {
			if fallbackImageURL != "" {
				variationImageURLs = append(variationImageURLs, fallbackImageURL)
			} else if len(allPictureURLs) > 0 {
				variationImageURLs = append(variationImageURLs, allPictureURLs...)
			}
		}

		for pictureIndex, variationImageURL := range variationImageURLs {
			images = append(images, mp.CatalogColorImage{
				ColorName: name,
				ImageURL:  variationImageURL,
				VideoURL:  videoURL,
				SortOrder: index*100 + pictureIndex,
			})
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
		value := stringify(attribute.ValueName)
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
		if value := stringify(attribute.ValueName); value != "" {
			parts = append(parts, value)
		}
	}
	if len(parts) > 0 {
		return strings.Join(parts, " / ")
	}
	if vID := stringify(variation.ID); vID != "" && vID != "0" {
		return vID
	}
	return fmt.Sprintf("Variacao %d", index+1)
}

func attributeValue(attributes []mercadoAttribute, id string) string {
	for _, attribute := range attributes {
		if strings.EqualFold(strings.TrimSpace(attribute.ID), id) {
			return stringify(attribute.ValueName)
		}
	}
	return ""
}
