package handlers

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProductHandler struct {
	cfg *config.Config
}

func NewProductHandler(cfg *config.Config) *ProductHandler {
	return &ProductHandler{cfg: cfg}
}

func withProductRelations(db *gorm.DB) *gorm.DB {
	return db.Preload("Category").Preload("ColorImages", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order asc, id asc")
	}).Preload("Variants", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order asc, id asc")
	}).Preload("ColorStocks", func(db *gorm.DB) *gorm.DB {
		return db.Order("color_name asc, id asc")
	})
}

func attachReviewSummaries(tenantID uint, products []models.Product) []models.Product {
	if len(products) == 0 {
		return products
	}

	productIDs := make([]uint, 0, len(products))
	for _, product := range products {
		productIDs = append(productIDs, product.ID)
	}

	type reviewAggregate struct {
		ProductID     uint
		AverageRating float64
		ReviewCount   int64
	}

	var aggregates []reviewAggregate
	database.DB.Model(&models.ProductReview{}).
		Select("product_id, AVG(rating) AS average_rating, COUNT(*) AS review_count").
		Where("tenant_id = ? AND product_id IN ?", tenantID, productIDs).
		Group("product_id").
		Scan(&aggregates)

	summaries := make(map[uint]models.ProductReviewSummary, len(aggregates))
	for _, aggregate := range aggregates {
		summaries[aggregate.ProductID] = models.ProductReviewSummary{
			AverageRating: aggregate.AverageRating,
			ReviewCount:   aggregate.ReviewCount,
		}
	}

	for i := range products {
		if summary, ok := summaries[products[i].ID]; ok {
			products[i].ReviewSummary = &summary
		}
	}

	return products
}

func attachReviewSummary(tenantID uint, product *models.Product) {
	products := attachReviewSummaries(tenantID, []models.Product{*product})
	if len(products) == 1 {
		*product = products[0]
	}
}

func syncProductColorImages(tenantID uint, productID uint, inputs []models.ProductColorImageInput) error {
	if err := database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Delete(&models.ProductColorImage{}).Error; err != nil {
		return err
	}

	for _, input := range inputs {
		colorName := strings.TrimSpace(input.ColorName)
		imageURL := strings.TrimSpace(input.ImageURL)
		if colorName == "" || imageURL == "" {
			continue
		}

		image := models.ProductColorImage{
			TenantID:  tenantID,
			ProductID: productID,
			ColorName: colorName,
			ImageURL:  imageURL,
			SortOrder: input.SortOrder,
		}
		if err := database.DB.Create(&image).Error; err != nil {
			return err
		}
	}

	return nil
}

func syncProductVariants(tenantID uint, productID uint, inputs []models.ProductVariantInput) error {
	if err := database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Delete(&models.ProductVariant{}).Error; err != nil {
		return err
	}

	for _, input := range inputs {
		colorName := strings.TrimSpace(input.ColorName)
		if colorName == "" || input.Price <= 0 {
			continue
		}

		variant := models.ProductVariant{
			TenantID:    tenantID,
			ProductID:   productID,
			ColorName:   colorName,
			Price:       input.Price,
			Material:    strings.TrimSpace(input.Material),
			LayerHeight: strings.TrimSpace(input.LayerHeight),
			PrintTime:   strings.TrimSpace(input.PrintTime),
			Weight:      strings.TrimSpace(input.Weight),
			IsActive:    input.IsActive,
			SortOrder:   input.SortOrder,
		}
		if err := database.DB.Create(&variant).Error; err != nil {
			return err
		}
	}

	return nil
}

func syncProductColorStocks(tenantID uint, productID uint, inputs []models.ProductColorStockInput) error {
	if err := database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Delete(&models.ProductColorStock{}).Error; err != nil {
		return err
	}

	for _, input := range inputs {
		colorName := strings.TrimSpace(input.ColorName)
		if colorName == "" {
			continue
		}

		stock := models.ProductColorStock{
			TenantID:  tenantID,
			ProductID: productID,
			ColorName: colorName,
			StockQty:  input.StockQty,
		}
		if err := database.DB.Create(&stock).Error; err != nil {
			return err
		}
	}

	return nil
}

func createStockMovement(db *gorm.DB, tenantID uint, productID uint, orderID *uint, colorName string, movementType string, delta int, quantityAfter int, reason string) error {
	if delta == 0 && movementType != "snapshot" {
		return nil
	}
	movement := models.StockMovement{
		TenantID:      tenantID,
		ProductID:     productID,
		OrderID:       orderID,
		ColorName:     strings.TrimSpace(colorName),
		MovementType:  movementType,
		QuantityDelta: delta,
		QuantityAfter: quantityAfter,
		Reason:        strings.TrimSpace(reason),
	}
	return db.Create(&movement).Error
}

func productColorStockMap(tenantID uint, productID uint) map[string]int {
	var rows []models.ProductColorStock
	database.DB.Where("tenant_id = ? AND product_id = ?", tenantID, productID).Find(&rows)
	result := make(map[string]int, len(rows))
	for _, row := range rows {
		result[strings.TrimSpace(row.ColorName)] = row.StockQty
	}
	return result
}

func getCustomerUserID(c *gin.Context) (uint, bool) {
	role, exists := c.Get("userRole")
	if !exists || role != "customer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Apenas compradores podem avaliar ou favoritar produtos"})
		return 0, false
	}

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario nao autenticado"})
		return 0, false
	}

	userID, ok := userIDVal.(uint)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario nao autenticado"})
		return 0, false
	}

	return userID, true
}

func (h *ProductHandler) GetStockMovements(c *gin.Context) {
	tenantID := getTenantID(c)
	query := database.DB.Preload("Product").Where("tenant_id = ?", tenantID)
	if productID := c.Query("product_id"); productID != "" {
		query = query.Where("product_id = ?", productID)
	}

	var movements []models.StockMovement
	if err := query.Order("created_at desc").Limit(100).Find(&movements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar historico de estoque"})
		return
	}

	c.JSON(http.StatusOK, movements)
}

func (h *ProductHandler) AdjustStock(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.StockAdjustmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados de estoque invalidos: " + err.Error()})
		return
	}

	color := strings.TrimSpace(input.ColorName)
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		reason = "Ajuste manual no admin"
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var product models.Product
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("tenant_id = ?", tenantID).First(&product, input.ProductID).Error; err != nil {
			return err
		}

		if color != "" {
			var stock models.ProductColorStock
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("tenant_id = ? AND product_id = ? AND color_name = ?", tenantID, product.ID, color).First(&stock).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				stock = models.ProductColorStock{TenantID: tenantID, ProductID: product.ID, ColorName: color}
				if err := tx.Create(&stock).Error; err != nil {
					return err
				}
			} else if err != nil {
				return err
			}
			delta := input.StockQty - stock.StockQty
			stock.StockQty = input.StockQty
			if err := tx.Save(&stock).Error; err != nil {
				return err
			}
			var totalColorStock int64
			if err := tx.Model(&models.ProductColorStock{}).Where("tenant_id = ? AND product_id = ?", tenantID, product.ID).Select("COALESCE(SUM(stock_qty), 0)").Scan(&totalColorStock).Error; err != nil {
				return err
			}
			product.StockQty = int(totalColorStock)
			product.InStock = product.StockQty > 0
			if err := tx.Save(&product).Error; err != nil {
				return err
			}
			return createStockMovement(tx, tenantID, product.ID, nil, color, "manual_adjustment", delta, stock.StockQty, reason)
		}

		delta := input.StockQty - product.StockQty
		product.StockQty = input.StockQty
		product.InStock = input.StockQty > 0
		if err := tx.Save(&product).Error; err != nil {
			return err
		}
		return createStockMovement(tx, tenantID, product.ID, nil, "", "manual_adjustment", delta, product.StockQty, reason)
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao ajustar estoque"})
		return
	}

	var product models.Product
	withProductRelations(database.DB).Where("tenant_id = ?", tenantID).First(&product, input.ProductID)
	c.JSON(http.StatusOK, product)
}

func parseProductIDParam(c *gin.Context) (uint, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de produto invalido"})
		return 0, false
	}
	return uint(id), true
}

func ensureTenantProduct(tenantID uint, productID uint) bool {
	var count int64
	database.DB.Model(&models.Product{}).Where("tenant_id = ? AND id = ?", tenantID, productID).Count(&count)
	return count > 0
}

func customerPurchasedProduct(tenantID uint, userID uint, productID uint) bool {
	var count int64
	database.DB.Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.tenant_id = ? AND orders.user_id = ? AND order_items.product_id = ? AND orders.status <> ?", tenantID, userID, productID, "cancelled").
		Count(&count)
	return count > 0
}

func getTenantID(c *gin.Context) uint {
	// Rotas autenticadas sempre respeitam o tenant do JWT. Neste momento nao
	// existe admin master; admin e tenant_admin pertencem a um tenant especifico.
	if ctxVal, exists := c.Get("tenantID"); exists {
		if id, ok := ctxVal.(uint); ok && id > 0 {
			return id
		}
	}

	// 1. Tentar pegar do header X-Tenant-ID
	if headerVal := c.GetHeader("X-Tenant-ID"); headerVal != "" {
		if id, err := strconv.Atoi(headerVal); err == nil && id > 0 {
			return uint(id)
		}
	}
	// 2. Tentar pegar da Query string ?tenant_id=
	if queryVal := c.Query("tenant_id"); queryVal != "" {
		if id, err := strconv.Atoi(queryVal); err == nil && id > 0 {
			return uint(id)
		}
	}
	// 3. Tentar pegar do contexto autenticado (JWT)
	if ctxVal, exists := c.Get("tenantID"); exists {
		if id, ok := ctxVal.(uint); ok && id > 0 {
			return id
		}
	}
	// Padrão: Tenant 1 (AZ3D)
	return 1
}

// GET /api/categories
func (h *ProductHandler) GetCategories(c *gin.Context) {
	tenantID := getTenantID(c)
	var categories []models.Category
	if err := database.DB.Where("tenant_id = ?", tenantID).Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar categorias"})
		return
	}
	c.JSON(http.StatusOK, categories)
}

// GET /api/products
func (h *ProductHandler) GetProducts(c *gin.Context) {
	tenantID := getTenantID(c)
	categorySlug := c.Query("category")
	searchQuery := c.Query("q")

	query := withProductRelations(database.DB.Model(&models.Product{}).Where("tenant_id = ? AND in_stock = ? AND (status = ? OR status = '')", tenantID, true, "active"))

	if categorySlug != "" && categorySlug != "todas" {
		var category models.Category
		if err := database.DB.Where("tenant_id = ? AND slug = ?", tenantID, categorySlug).First(&category).Error; err == nil {
			query = query.Where("category_id = ?", category.ID)
		}
	}

	if searchQuery != "" {
		searchTerm := "%" + searchQuery + "%"
		query = query.Where("title LIKE ? OR description LIKE ? OR material LIKE ?", searchTerm, searchTerm, searchTerm)
	}

	var products []models.Product
	if err := query.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar produtos"})
		return
	}

	c.JSON(http.StatusOK, attachReviewSummaries(tenantID, products))
}

// GET /api/products/:id
func (h *ProductHandler) GetProductByID(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de produto inválido"})
		return
	}

	var product models.Product
	if err := withProductRelations(database.DB.Where("tenant_id = ? AND in_stock = ? AND (status = ? OR status = '')", tenantID, true, "active")).First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto não encontrado"})
		return
	}

	attachReviewSummary(tenantID, &product)
	c.JSON(http.StatusOK, product)
}

// --- ROTAS ADMINISTRATIVAS ---

// GET /api/admin/products
func (h *ProductHandler) GetAdminProducts(c *gin.Context) {
	tenantID := getTenantID(c)
	searchQuery := c.Query("q")

	query := withProductRelations(database.DB.Model(&models.Product{}).Where("tenant_id = ?", tenantID))
	if searchQuery != "" {
		searchTerm := "%" + searchQuery + "%"
		query = query.Where("title LIKE ? OR description LIKE ? OR material LIKE ?", searchTerm, searchTerm, searchTerm)
	}

	var products []models.Product
	if err := query.Order("created_at desc").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar produtos do admin"})
		return
	}

	c.JSON(http.StatusOK, attachReviewSummaries(tenantID, products))
}

// POST /api/admin/products
func (h *ProductHandler) CreateProduct(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.ProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados inválidos: " + err.Error()})
		return
	}

	// Gerar slug amigável se não for fornecido
	slug := input.Slug
	if slug == "" {
		slug = strconv.FormatInt(int64(input.CategoryID), 10) + "-" + strconv.FormatInt(int64(input.Price), 10)
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "active"
	}

	if input.Pricing != nil {
		_, pricingResult := calculatePricingForTenant(tenantID, *input.Pricing)
		input.Price = math.Round(pricingResult.SuggestedPrice*100) / 100
	}

	product := models.Product{
		TenantID:    tenantID,
		Title:       input.Title,
		Slug:        slug,
		SKU:         strings.TrimSpace(input.SKU),
		Description: input.Description,
		Price:       input.Price,
		ImageURL:    input.ImageURL,
		CategoryID:  input.CategoryID,
		Material:    input.Material,
		LayerHeight: input.LayerHeight,
		PrintTime:   input.PrintTime,
		Dimensions:  input.Dimensions,
		Weight:      input.Weight,
		InStock:     input.InStock,
		StockQty:    input.StockQty,
		Status:      status,
	}

	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar produto: " + err.Error()})
		return
	}
	if product.SKU == "" {
		product.SKU = fmt.Sprintf("AZ3D-%d-%d", tenantID, product.ID)
		if err := database.DB.Save(&product).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar SKU do produto"})
			return
		}
	}

	if err := syncProductColorImages(tenantID, product.ID, input.ColorImages); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar imagens por cor: " + err.Error()})
		return
	}
	if err := syncProductVariants(tenantID, product.ID, input.Variants); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar variacoes: " + err.Error()})
		return
	}
	if err := syncProductColorStocks(tenantID, product.ID, input.ColorStocks); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar estoque por cor: " + err.Error()})
		return
	}
	if input.Pricing != nil {
		if err := createProductPricingSnapshot(tenantID, product.ID, *input.Pricing); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar historico de precificacao: " + err.Error()})
			return
		}
	}

	withProductRelations(database.DB).First(&product, product.ID)
	c.JSON(http.StatusCreated, product)
}

// PUT /api/admin/products/:id
func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de produto invalido"})
		return
	}

	var product models.Product
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}
	previousStockQty := product.StockQty
	previousColorStocks := productColorStockMap(tenantID, product.ID)

	var input models.ProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados invalidos: " + err.Error()})
		return
	}

	product.Title = input.Title
	if input.Slug != "" {
		product.Slug = input.Slug
	}
	if strings.TrimSpace(input.SKU) != "" {
		product.SKU = strings.TrimSpace(input.SKU)
	} else if product.SKU == "" {
		product.SKU = fmt.Sprintf("AZ3D-%d-%d", tenantID, product.ID)
	}
	product.Description = input.Description
	if input.Pricing != nil {
		_, pricingResult := calculatePricingForTenant(tenantID, *input.Pricing)
		product.Price = math.Round(pricingResult.SuggestedPrice*100) / 100
	} else {
		product.Price = input.Price
	}
	if input.ImageURL != "" {
		product.ImageURL = input.ImageURL
	}
	if input.CategoryID > 0 {
		product.CategoryID = input.CategoryID
	}
	if input.Material != "" {
		product.Material = input.Material
	}
	if input.LayerHeight != "" {
		product.LayerHeight = input.LayerHeight
	}
	if input.PrintTime != "" {
		product.PrintTime = input.PrintTime
	}
	if input.Dimensions != "" {
		product.Dimensions = input.Dimensions
	}
	if input.Weight != "" {
		product.Weight = input.Weight
	}
	product.InStock = input.InStock
	product.StockQty = input.StockQty
	if input.Status != "" {
		product.Status = input.Status
	}

	if err := database.DB.Save(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar produto"})
		return
	}
	if previousStockQty != product.StockQty {
		_ = createStockMovement(database.DB, tenantID, product.ID, nil, "", "manual_adjustment", product.StockQty-previousStockQty, product.StockQty, "Ajuste no cadastro do produto")
	}

	if err := syncProductColorImages(tenantID, product.ID, input.ColorImages); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar imagens por cor"})
		return
	}
	if err := syncProductVariants(tenantID, product.ID, input.Variants); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar variacoes"})
		return
	}
	if err := syncProductColorStocks(tenantID, product.ID, input.ColorStocks); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar estoque por cor"})
		return
	}
	for _, stockInput := range input.ColorStocks {
		colorName := strings.TrimSpace(stockInput.ColorName)
		if colorName == "" {
			continue
		}
		previousQty := previousColorStocks[colorName]
		if previousQty != stockInput.StockQty {
			_ = createStockMovement(database.DB, tenantID, product.ID, nil, colorName, "manual_adjustment", stockInput.StockQty-previousQty, stockInput.StockQty, "Ajuste no cadastro do produto")
		}
	}
	if input.Pricing != nil {
		if err := createProductPricingSnapshot(tenantID, product.ID, *input.Pricing); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar historico de precificacao"})
			return
		}
	}

	withProductRelations(database.DB).First(&product, product.ID)
	c.JSON(http.StatusOK, product)
}

// GET /api/products/:id/reviews
func (h *ProductHandler) GetProductReviews(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	if !ensureTenantProduct(tenantID, productID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}

	var reviews []models.ProductReview
	if err := database.DB.Preload("User").Where("tenant_id = ? AND product_id = ?", tenantID, productID).Order("created_at desc").Find(&reviews).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar avaliacoes"})
		return
	}

	c.JSON(http.StatusOK, reviews)
}

// POST /api/products/:id/reviews
func (h *ProductHandler) UpsertProductReview(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	userID, ok := getCustomerUserID(c)
	if !ok {
		return
	}

	if !ensureTenantProduct(tenantID, productID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}

	if !customerPurchasedProduct(tenantID, userID, productID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Avaliacao disponivel apenas para compradores deste produto"})
		return
	}

	var input models.ProductReviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados da avaliacao invalidos: " + err.Error()})
		return
	}

	var review models.ProductReview
	err := database.DB.Where("tenant_id = ? AND product_id = ? AND user_id = ?", tenantID, productID, userID).First(&review).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		review = models.ProductReview{
			TenantID:  tenantID,
			ProductID: productID,
			UserID:    userID,
			Rating:    input.Rating,
			Comment:   input.Comment,
		}
		if err := database.DB.Create(&review).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar avaliacao"})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar avaliacao"})
		return
	} else {
		review.Rating = input.Rating
		review.Comment = input.Comment
		if err := database.DB.Save(&review).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar avaliacao"})
			return
		}
	}

	c.JSON(http.StatusOK, review)
}

// POST /api/products/:id/favorite
func (h *ProductHandler) AddProductFavorite(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	userID, ok := getCustomerUserID(c)
	if !ok {
		return
	}

	if !ensureTenantProduct(tenantID, productID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto nao encontrado"})
		return
	}

	favorite := models.ProductFavorite{TenantID: tenantID, ProductID: productID, UserID: userID}
	if err := database.DB.Where("tenant_id = ? AND product_id = ? AND user_id = ?", tenantID, productID, userID).FirstOrCreate(&favorite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao favoritar produto"})
		return
	}

	c.JSON(http.StatusOK, favorite)
}

// DELETE /api/products/:id/favorite
func (h *ProductHandler) RemoveProductFavorite(c *gin.Context) {
	tenantID := getTenantID(c)
	productID, ok := parseProductIDParam(c)
	if !ok {
		return
	}

	userID, ok := getCustomerUserID(c)
	if !ok {
		return
	}

	if err := database.DB.Where("tenant_id = ? AND product_id = ? AND user_id = ?", tenantID, productID, userID).Delete(&models.ProductFavorite{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao remover favorito"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Favorito removido com sucesso"})
}

// GET /api/favorites
func (h *ProductHandler) GetMyFavorites(c *gin.Context) {
	tenantID := getTenantID(c)
	userID, ok := getCustomerUserID(c)
	if !ok {
		return
	}

	var favorites []models.ProductFavorite
	if err := database.DB.Preload("Product.Category").Preload("Product.ColorImages", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order asc, id asc")
	}).Where("tenant_id = ? AND user_id = ?", tenantID, userID).Order("created_at desc").Find(&favorites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar favoritos"})
		return
	}

	c.JSON(http.StatusOK, favorites)
}

// POST /api/admin/uploads/products
func (h *ProductHandler) UploadProductImage(c *gin.Context) {
	tenantID := getTenantID(c)
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Imagem nao enviada"})
		return
	}
	if h.cfg != nil && h.cfg.MaxUploadBytes > 0 && file.Size > h.cfg.MaxUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Imagem acima do tamanho maximo permitido"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowed[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Formato de imagem invalido"})
		return
	}

	dir := filepath.Join("uploads", "products", strconv.Itoa(int(tenantID)))
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao preparar diretorio de upload"})
		return
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destination := filepath.Join(dir, filename)
	if err := c.SaveUploadedFile(file, destination); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar imagem"})
		return
	}

	publicURL := "/" + filepath.ToSlash(destination)
	c.JSON(http.StatusCreated, gin.H{"url": publicURL})
}

// DELETE /api/admin/products/:id
func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	tenantID := getTenantID(c)
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de produto inválido"})
		return
	}

	var product models.Product
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produto não encontrado"})
		return
	}

	if err := database.DB.Delete(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao excluir produto"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Produto removido com sucesso"})
}

// POST /api/admin/categories
func (h *ProductHandler) CreateCategory(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados inválidos: " + err.Error()})
		return
	}

	slug := input.Slug
	if slug == "" {
		slug = input.Name
	}

	icon := input.Icon
	if icon == "" {
		icon = "box"
	}

	category := models.Category{
		TenantID:    tenantID,
		Name:        input.Name,
		Slug:        slug,
		Description: input.Description,
		Icon:        icon,
	}

	if err := database.DB.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar categoria"})
		return
	}

	c.JSON(http.StatusCreated, category)
}
