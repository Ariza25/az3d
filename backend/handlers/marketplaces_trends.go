package handlers

import (
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"az3d-backend/internal/marketplaces/amazon"
	"az3d-backend/internal/marketplaces/crawler"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/internal/marketplaces/shopee"
	"az3d-backend/internal/marketplaces/worker"

	"github.com/gin-gonic/gin"
)

// GetMLTrends returns current search trends in Mercado Livre, Shopee, or Amazon
func (h *MarketplaceHandler) GetMLTrends(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	if provider == "" {
		provider = "mercadolivre"
	}
	categoryID := c.Query("category")
	tenantID := getTenantID(c)

	var meliToken string
	if tenantID > 0 {
		if account, err := getOrCreateMercadoLivreAccount(tenantID); err == nil && account.IsConnected {
			_ = h.ensureFreshMarketplaceToken(c.Request.Context(), &account)
			meliToken = account.AccessToken
		}
	}

	w := worker.GetGlobalWorker()
	var trends []crawler.TrendingKeyword
	var err error
	if w != nil {
		trends, err = w.GetCachedTrends(c.Request.Context(), provider, categoryID, meliToken)
	} else {
		if provider == "shopee" {
			trends, err = crawler.FetchShopeeTrends(c.Request.Context(), categoryID)
		} else if provider == "amazon" {
			conn := amazon.New()
			amzTrends, amzErr := conn.FetchTrends(c.Request.Context(), categoryID)
			err = amzErr
			for _, at := range amzTrends {
				trends = append(trends, crawler.TrendingKeyword{
					Keyword:     at.Keyword,
					Category:    at.Category,
					Rank:        at.Rank,
					Status:      at.Status,
					SearchVol:   at.SearchVol,
					VolumeTrend: at.VolumeTrend,
					URL:         "https://www.amazon.com.br/s?k=" + url.QueryEscape(at.Keyword),
					Source:      "amazon_catalog",
				})
			}
		} else {
			trends, err = crawler.FetchMercadoLivreTrends(c.Request.Context(), categoryID, meliToken)
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar tendências: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"provider": provider,
		"category": categoryID,
		"trends":   trends,
	})
}

// RefreshMarketplaceTrends triggers immediate on-demand re-crawl of marketplace trends
func (h *MarketplaceHandler) RefreshMarketplaceTrends(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	if provider == "" {
		provider = "mercadolivre"
	}
	categoryID := c.Query("category")
	tenantID := getTenantID(c)

	var meliToken string
	if tenantID > 0 {
		if account, err := getOrCreateMercadoLivreAccount(tenantID); err == nil && account.IsConnected {
			_ = h.ensureFreshMarketplaceToken(c.Request.Context(), &account)
			meliToken = account.AccessToken
		}
	}

	w := worker.GetGlobalWorker()
	if w != nil {
		if err := w.RefreshAll(c.Request.Context(), meliToken); err != nil {
			log.Printf("[RefreshMarketplaceTrends] Aviso durante atualização: %v", err)
		}
		trends, _ := w.GetCachedTrends(c.Request.Context(), provider, categoryID, meliToken)
		c.JSON(http.StatusOK, gin.H{
			"message":  "Tendências atualizadas com sucesso em tempo real",
			"provider": provider,
			"category": categoryID,
			"trends":   trends,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Worker não inicializado"})
}

// GetMLSearchInsights returns detailed competitor and price analysis for a keyword
func (h *MarketplaceHandler) GetMLSearchInsights(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	if provider == "" {
		provider = "mercadolivre"
	}
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		query = "impressao 3d"
	}

	if provider == "shopee" {
		conn := shopee.New()
		insights, err := conn.FetchSearchInsights(c.Request.Context(), query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao analisar concorrência da Shopee: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, insights)
		return
	}

	if provider == "amazon" {
		conn := amazon.New()
		insights, err := conn.FetchSearchInsights(c.Request.Context(), query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao analisar concorrência da Amazon: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, insights)
		return
	}

	tenantID := getTenantID(c)
	var meliToken string
	if tenantID > 0 {
		if account, err := getOrCreateMercadoLivreAccount(tenantID); err == nil && account.IsConnected {
			_ = h.ensureFreshMarketplaceToken(c.Request.Context(), &account)
			meliToken = account.AccessToken
		}
	}

	conn := mercadolivre.New()
	insights, err := conn.FetchSearchInsightsWithToken(c.Request.Context(), query, meliToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao analisar concorrência do Mercado Livre: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, insights)
}

// AuditMLListing performs SEO & health score audit on a product listing
func (h *MarketplaceHandler) AuditMLListing(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	title := c.Query("title")
	if title == "" {
		title = "Suporte de Headset Gamer 3D Universal PLA"
	}

	priceStr := c.Query("price")
	price, _ := strconv.ParseFloat(priceStr, 64)
	if price <= 0 {
		price = 69.90
	}

	imagesStr := c.Query("images")
	images, _ := strconv.Atoi(imagesStr)
	if images <= 0 {
		images = 4
	}

	freeShipping := c.Query("free_shipping") == "true"
	fullShipping := c.Query("full_shipping") == "true"
	material := c.Query("material")

	if provider == "shopee" {
		audit := shopee.AuditShopeeListing(title, price, images, freeShipping, fullShipping, material)
		c.JSON(http.StatusOK, audit)
		return
	}

	if provider == "amazon" {
		audit := amazon.AuditAmazonListing(title, price, images, freeShipping, fullShipping, material)
		c.JSON(http.StatusOK, audit)
		return
	}

	audit := mercadolivre.AuditListing(title, price, images, freeShipping, fullShipping, material)
	c.JSON(http.StatusOK, audit)
}

// GetMLProductOpportunities returns high-demand 3D printing product opportunities
func (h *MarketplaceHandler) GetMLProductOpportunities(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	category := c.Query("category")

	if provider == "shopee" {
		opps := shopee.GetShopeeProductOpportunities(category)
		c.JSON(http.StatusOK, gin.H{
			"provider":      "shopee",
			"category":      category,
			"opportunities": opps,
		})
		return
	}

	if provider == "amazon" {
		opps := amazon.GetAmazonProductOpportunities(category)
		c.JSON(http.StatusOK, gin.H{
			"provider":      "amazon",
			"category":      category,
			"opportunities": opps,
		})
		return
	}

	opps := mercadolivre.GetProductOpportunities(category)
	c.JSON(http.StatusOK, gin.H{
		"provider":      "mercadolivre",
		"category":      category,
		"opportunities": opps,
	})
}
