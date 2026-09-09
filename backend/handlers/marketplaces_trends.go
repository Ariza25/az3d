package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"az3d-backend/internal/marketplaces/amazon"
	"az3d-backend/internal/marketplaces/mercadolivre"
	"az3d-backend/internal/marketplaces/shopee"

	"github.com/gin-gonic/gin"
)

// GetMLTrends returns current search trends in Mercado Livre, Shopee, or Amazon
func (h *MarketplaceHandler) GetMLTrends(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	categoryID := c.Query("category")

	if provider == "shopee" {
		conn := shopee.New()
		trends, err := conn.FetchTrends(c.Request.Context(), categoryID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar tendências da Shopee: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"provider": "shopee",
			"category": categoryID,
			"trends":   trends,
		})
		return
	}

	if provider == "amazon" {
		conn := amazon.New()
		trends, err := conn.FetchTrends(c.Request.Context(), categoryID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar tendências da Amazon: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"provider": "amazon",
			"category": categoryID,
			"trends":   trends,
		})
		return
	}

	conn := mercadolivre.New()
	trends, err := conn.FetchTrends(c.Request.Context(), categoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar tendências do Mercado Livre: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"provider": "mercadolivre",
		"category": categoryID,
		"trends":   trends,
	})
}

// GetMLSearchInsights returns detailed competitor and price analysis for a keyword
func (h *MarketplaceHandler) GetMLSearchInsights(c *gin.Context) {
	provider := strings.ToLower(c.Query("provider"))
	query := c.Query("q")
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

	conn := mercadolivre.New()
	insights, err := conn.FetchSearchInsights(c.Request.Context(), query)
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
