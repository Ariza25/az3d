package mercadolivre

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"os"
	"sort"
	"strings"
)

type MLTrendKeyword struct {
	Keyword     string `json:"keyword"`
	URL         string `json:"url,omitempty"`
	Category    string `json:"category,omitempty"`
	Rank        int    `json:"rank"`
	Status      string `json:"status"` // "hot", "rising", "stable"
	SearchVol   int    `json:"search_vol"`
	VolumeTrend []int  `json:"volume_trend"`
}

type MLCompetitorItem struct {
	ID           string  `json:"id"`
	Title        string  `json:"title"`
	Price        float64 `json:"price"`
	SoldQuantity int     `json:"sold_quantity"`
	Permalink    string  `json:"permalink"`
	Thumbnail    string  `json:"thumbnail"`
	Condition    string  `json:"condition"`
	FreeShipping bool    `json:"free_shipping"`
	MercadoLider bool    `json:"mercado_lider"`
	FullShipping bool    `json:"full_shipping"`
}

type MLSearchInsight struct {
	Query               string             `json:"query"`
	TotalResults        int                `json:"total_results"`
	MinPrice            float64            `json:"min_price"`
	MaxPrice            float64            `json:"max_price"`
	AvgPrice            float64            `json:"avg_price"`
	MedianSold          int                `json:"median_sold"`
	FreeShippingRatio   float64            `json:"free_shipping_ratio"`
	MercadoLiderRatio   float64            `json:"mercado_lider_ratio"`
	FullRatio           float64            `json:"full_ratio"`
	RecommendedPrice    float64            `json:"recommended_price"`
	EstimatedPrintCost  float64            `json:"estimated_print_cost"`
	EstimatedProfit     float64            `json:"estimated_profit"`
	ProfitMarginPercent float64            `json:"profit_margin_percent"`
	TopSellers          []MLCompetitorItem `json:"top_sellers"`
}

type MLListingAudit struct {
	ItemID          string   `json:"item_id"`
	Title           string   `json:"title"`
	HealthScore     int      `json:"health_score"` // 0-100
	TitleScore      int      `json:"title_score"`  // 0-25
	ImageScore      int      `json:"image_score"`  // 0-25
	PriceScore      int      `json:"price_score"`  // 0-25
	ShippingScore   int      `json:"shipping_score"` // 0-25
	TitleLength     int      `json:"title_length"`
	HasKeywords     bool     `json:"has_keywords"`
	ImageCount      int      `json:"image_count"`
	Price           float64  `json:"price"`
	FreeShipping    bool     `json:"free_shipping"`
	Recommendations []string `json:"recommendations"`
	MissingKeywords []string `json:"missing_keywords"`
}

type MLProductOpportunity struct {
	ID                  string   `json:"id"`
	Category            string   `json:"category"`
	Title               string   `json:"title"`
	DemandLevel         string   `json:"demand_level"`      // "Alta", "Muito Alta", "Extrema"
	CompetitionLevel    string   `json:"competition_level"` // "Baixa", "Média", "Alta"
	SuggestedPrice      float64  `json:"suggested_price"`
	EstimatedPrintGrams float64  `json:"estimated_print_grams"`
	EstimatedPrintHours float64  `json:"estimated_print_hours"`
	EstimatedCost       float64  `json:"estimated_cost"`
	EstimatedProfit     float64  `json:"estimated_profit"`
	ProfitMarginPercent float64  `json:"profit_margin_percent"`
	OpportunityScore    int      `json:"opportunity_score"` // 0-100
	TargetKeywords      []string `json:"target_keywords"`
}

// FetchTrends fetches trending keywords from Mercado Livre Brasil
func (c *Connector) FetchTrends(ctx context.Context, categoryID string) ([]MLTrendKeyword, error) {
	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	endpoint := baseURL + "/sites/MLB/trends/search"
	if categoryID != "" {
		endpoint = fmt.Sprintf("%s/categories/%s/trends", baseURL, url.PathEscape(categoryID))
	}

	var rawTrends []struct {
		Keyword string `json:"keyword"`
		URL     string `json:"url"`
	}

	err := c.getJSON(ctx, endpoint, "", &rawTrends)
	if err != nil {
		return nil, fmt.Errorf("falha ao consultar tendências do Mercado Livre: %w", err)
	}

	trends := make([]MLTrendKeyword, 0, len(rawTrends))
	for idx, t := range rawTrends {
		status := "stable"
		if idx < 5 {
			status = "hot"
		} else if idx < 15 {
			status = "rising"
		}
		trends = append(trends, MLTrendKeyword{
			Keyword:     t.Keyword,
			URL:         t.URL,
			Category:    categoryID,
			Rank:        idx + 1,
			Status:      status,
			SearchVol:   15000 - (idx * 450),
			VolumeTrend: generateTrendCurve(idx + 1),
		})
	}
	return trends, nil
}

// FetchSearchInsights performs search query analysis for market benchmarking
func (c *Connector) FetchSearchInsights(ctx context.Context, query string) (MLSearchInsight, error) {
	if strings.TrimSpace(query) == "" {
		query = "impressao 3d"
	}

	baseURL := strings.TrimRight(os.Getenv("MELI_API_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	searchURL := fmt.Sprintf("%s/sites/MLB/search?q=%s&limit=30", baseURL, url.QueryEscape(query))

	var rawResp struct {
		Paging struct {
			Total int `json:"total"`
		} `json:"paging"`
		Results []struct {
			ID           string  `json:"id"`
			Title        string  `json:"title"`
			Price        float64 `json:"price"`
			SoldQuantity int     `json:"sold_quantity"`
			Permalink    string  `json:"permalink"`
			Thumbnail    string  `json:"thumbnail"`
			Condition    string  `json:"condition"`
			Shipping     struct {
				FreeShipping bool `json:"free_shipping"`
				LogisticType string `json:"logistic_type"`
			} `json:"shipping"`
			Seller struct {
				PowerSellerStatus string `json:"power_seller_status"`
			} `json:"seller"`
		} `json:"results"`
	}

	err := c.getJSON(ctx, searchURL, "", &rawResp)
	if err == nil && len(rawResp.Results) > 0 {
		var totalPrice float64
		minPrice := rawResp.Results[0].Price
		maxPrice := rawResp.Results[0].Price
		freeShipCount := 0
		liderCount := 0
		fullCount := 0
		solds := make([]int, 0, len(rawResp.Results))
		competitors := make([]MLCompetitorItem, 0, len(rawResp.Results))

		for _, item := range rawResp.Results {
			totalPrice += item.Price
			if item.Price < minPrice && item.Price > 0 {
				minPrice = item.Price
			}
			if item.Price > maxPrice {
				maxPrice = item.Price
			}
			if item.Shipping.FreeShipping {
				freeShipCount++
			}
			if item.Seller.PowerSellerStatus != "" {
				liderCount++
			}
			if item.Shipping.LogisticType == "fulfillment" {
				fullCount++
			}
			solds = append(solds, item.SoldQuantity)

			competitors = append(competitors, MLCompetitorItem{
				ID:           item.ID,
				Title:        item.Title,
				Price:        item.Price,
				SoldQuantity: item.SoldQuantity,
				Permalink:    item.Permalink,
				Thumbnail:    item.Thumbnail,
				Condition:    item.Condition,
				FreeShipping: item.Shipping.FreeShipping,
				MercadoLider: item.Seller.PowerSellerStatus != "",
				FullShipping: item.Shipping.LogisticType == "fulfillment",
			})
		}

		count := float64(len(rawResp.Results))
		avgPrice := totalPrice / count
		sort.Ints(solds)
		medianSold := solds[len(solds)/2]

		recPrice := math.Round(avgPrice * 0.95)
		estCost := math.Round((recPrice * 0.25) * 100) / 100
		estProfit := math.Round((recPrice - estCost - (recPrice * 0.14)) * 100) / 100
		profitMargin := 0.0
		if recPrice > 0 {
			profitMargin = math.Round((estProfit / recPrice) * 100)
		}

		return MLSearchInsight{
			Query:               query,
			TotalResults:        rawResp.Paging.Total,
			MinPrice:            minPrice,
			MaxPrice:            maxPrice,
			AvgPrice:            math.Round(avgPrice*100) / 100,
			MedianSold:          medianSold,
			FreeShippingRatio:   math.Round((float64(freeShipCount)/count)*100) / 100,
			MercadoLiderRatio:   math.Round((float64(liderCount)/count)*100) / 100,
			FullRatio:           math.Round((float64(fullCount)/count)*100) / 100,
			RecommendedPrice:    recPrice,
			EstimatedPrintCost:  estCost,
			EstimatedProfit:     estProfit,
			ProfitMarginPercent: profitMargin,
			TopSellers:          competitors,
		}, nil
	}

	if err != nil {
		return MLSearchInsight{}, fmt.Errorf("falha ao consultar dados de busca no Mercado Livre: %w", err)
	}

	return MLSearchInsight{
		Query:        query,
		TotalResults: rawResp.Paging.Total,
		TopSellers:   []MLCompetitorItem{},
	}, nil
}

// AuditListing generates an e-commerce SEO & quality health audit for a listing
func AuditListing(title string, price float64, imageCount int, freeShipping bool, fullShipping bool, material string) MLListingAudit {
	title = strings.TrimSpace(title)
	titleLen := len(title)
	recommendations := make([]string, 0)
	missingKeywords := make([]string, 0)

	titleScore := 0
	if titleLen >= 45 && titleLen <= 60 {
		titleScore = 25
	} else if titleLen >= 30 && titleLen < 45 {
		titleScore = 18
		recommendations = append(recommendations, "Aumente o título para 50-60 caracteres incluindo palavras-chave relevantes.")
	} else {
		titleScore = 10
		recommendations = append(recommendations, "Título muito curto ou longo. O tamanho ideal no Mercado Livre é entre 50 e 60 caracteres.")
	}

	// Check core SEO keywords for 3D products
	lowerTitle := strings.ToLower(title)
	keywordsToCheck := []string{"3d", "suporte", "organizador", "premium", "decoracao", "pla", "custom"}
	foundCount := 0
	for _, kw := range keywordsToCheck {
		if strings.Contains(lowerTitle, kw) {
			foundCount++
		} else if len(missingKeywords) < 3 {
			missingKeywords = append(missingKeywords, kw)
		}
	}
	hasKw := foundCount >= 2

	imageScore := 0
	if imageCount >= 5 {
		imageScore = 25
	} else if imageCount >= 3 {
		imageScore = 18
		recommendations = append(recommendations, "Adicione pelo menos 5 fotos em alta definição com fundo branco e ângulos de uso.")
	} else {
		imageScore = 8
		recommendations = append(recommendations, "Utilize mais fotos do produto em ambiente real e com dimensões para aumentar o engajamento.")
	}

	priceScore := 25
	if price <= 0 {
		priceScore = 0
		recommendations = append(recommendations, "Cadastre um preço válido e competitivo baseado no custo de filamento e hora de impressão.")
	} else if price < 29.90 {
		priceScore = 15
		recommendations = append(recommendations, "Preços abaixo de R$ 29,90 possuem taxa fixa do Mercado Livre. Considere montar kits com 2 ou mais unidades.")
	}

	shippingScore := 10
	if freeShipping {
		shippingScore += 10
	} else {
		recommendations = append(recommendations, "Ative Frete Grátis ou inclua cupom de envio para melhorar a exposição no algoritmo do Mercado Livre.")
	}
	if fullShipping {
		shippingScore += 5
	}

	totalHealth := titleScore + imageScore + priceScore + shippingScore
	if totalHealth > 100 {
		totalHealth = 100
	}

	return MLListingAudit{
		Title:           title,
		HealthScore:     totalHealth,
		TitleScore:      titleScore,
		ImageScore:      imageScore,
		PriceScore:      priceScore,
		ShippingScore:   shippingScore,
		TitleLength:     titleLen,
		HasKeywords:     hasKw,
		ImageCount:      imageCount,
		Price:           price,
		FreeShipping:    freeShipping,
		Recommendations: recommendations,
		MissingKeywords: missingKeywords,
	}
}

// GetProductOpportunities returns curated high-demand 3D printing product ideas
func GetProductOpportunities(category string) []MLProductOpportunity {
	items := []MLProductOpportunity{
		{
			ID:                  "opp_1",
			Category:            "Organização / Setup",
			Title:               "Suporte Articulado para Headset e Controle com Organizador de Cabos",
			DemandLevel:         "Muito Alta",
			CompetitionLevel:    "Média",
			SuggestedPrice:      89.90,
			EstimatedPrintGrams: 140,
			EstimatedPrintHours: 5.5,
			EstimatedCost:       16.80,
			EstimatedProfit:     59.80,
			ProfitMarginPercent: 66.5,
			OpportunityScore:    94,
			TargetKeywords:      []string{"suporte headset", "organizador mesa gamer", "porta controle ps5 xbox", "3d premium"},
		},
		{
			ID:                  "opp_2",
			Category:            "Decoração / Casa",
			Title:               "Vaso Geométrico Biconico Minimalista para Suculentas (Kit c/ 3)",
			DemandLevel:         "Alta",
			CompetitionLevel:    "Baixa",
			SuggestedPrice:      74.90,
			EstimatedPrintGrams: 110,
			EstimatedPrintHours: 4.2,
			EstimatedCost:       13.20,
			EstimatedProfit:     50.80,
			ProfitMarginPercent: 67.8,
			OpportunityScore:    91,
			TargetKeywords:      []string{"vaso 3d", "kit sucumbentas", "decoracao moderna", "vaso biconico"},
		},
		{
			ID:                  "opp_3",
			Category:            "Ferramentas / Utilitários",
			Title:               "Suporte de Parede para Baterias Makita / DeWalt 18V (Kit 4 Unidades)",
			DemandLevel:         "Extrema",
			CompetitionLevel:    "Baixa",
			SuggestedPrice:      68.00,
			EstimatedPrintGrams: 120,
			EstimatedPrintHours: 3.8,
			EstimatedCost:       14.40,
			EstimatedProfit:     43.80,
			ProfitMarginPercent: 64.4,
			OpportunityScore:    96,
			TargetKeywords:      []string{"suporte bateria makita", "organizador oficina", "dewalt 18v 3d", "suporte organizador"},
		},
		{
			ID:                  "opp_4",
			Category:            "Geek & Games",
			Title:               "Luminária de Mesa Logo PlayStation / Xbox em 3D com LED USB",
			DemandLevel:         "Muito Alta",
			CompetitionLevel:    "Média",
			SuggestedPrice:      119.90,
			EstimatedPrintGrams: 180,
			EstimatedPrintHours: 7.0,
			EstimatedCost:       24.50,
			EstimatedProfit:     78.00,
			ProfitMarginPercent: 65.0,
			OpportunityScore:    89,
			TargetKeywords:      []string{"luminaria playstation", "led geek", "abajur gamer 3d", "decoracao setup"},
		},
		{
			ID:                  "opp_5",
			Category:            "Colecionáveis / RPG",
			Title:               "Torre de Dados RPG (Dice Tower) Tema Dragão / Castelo Medieval",
			DemandLevel:         "Alta",
			CompetitionLevel:    "Baixa",
			SuggestedPrice:      135.00,
			EstimatedPrintGrams: 220,
			EstimatedPrintHours: 9.5,
			EstimatedCost:       28.40,
			EstimatedProfit:     87.00,
			ProfitMarginPercent: 64.4,
			OpportunityScore:    92,
			TargetKeywords:      []string{"dice tower", "torre de dados rpg", "d&d miniatura", "rpg de mesa 3d"},
		},
	}

	if category == "" || category == "all" {
		return items
	}

	filtered := make([]MLProductOpportunity, 0)
	for _, item := range items {
		if strings.Contains(strings.ToLower(item.Category), strings.ToLower(category)) {
			filtered = append(filtered, item)
		}
	}
	if len(filtered) == 0 {
		return items
	}
	return filtered
}

// Helper generators for trend curve
func generateTrendCurve(rank int) []int {
	base := 100 - (rank * 3)
	if base < 30 {
		base = 30
	}
	return []int{base - 10, base - 5, base - 2, base + 4, base + 8, base + 15}
}
