package handlers

import (
	"net/http"
	"strconv"

	"az3d-backend/internal/marketplaces/mercadolivre"

	"github.com/gin-gonic/gin"
)

// GetMLTrends returns current search trends in Mercado Livre
func (h *MarketplaceHandler) GetMLTrends(c *gin.Context) {
	categoryID := c.Query("category")
	conn := mercadolivre.New()

	trends, err := conn.FetchTrends(c.Request.Context(), categoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao buscar tendências do Mercado Livre: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"category": categoryID,
		"trends":   trends,
	})
}

// GetMLSearchInsights returns detailed competitor and price analysis for a keyword
func (h *MarketplaceHandler) GetMLSearchInsights(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		query = "impressao 3d"
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

	audit := mercadolivre.AuditListing(title, price, images, freeShipping, fullShipping, material)
	c.JSON(http.StatusOK, audit)
}

// GetMLProductOpportunities returns high-demand 3D printing product opportunities
func (h *MarketplaceHandler) GetMLProductOpportunities(c *gin.Context) {
	category := c.Query("category")
	opps := mercadolivre.GetProductOpportunities(category)
	c.JSON(http.StatusOK, gin.H{
		"category":      category,
		"opportunities": opps,
	})
}
