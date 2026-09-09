package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"az3d-backend/database"
	"az3d-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GET /api/admin/marketplaces/mappings
func (h *MarketplaceHandler) GetProductMappings(c *gin.Context) {
	tenantID := getTenantID(c)

	var mappings []models.MarketplaceProductMapping
	if err := database.DB.Preload("Product").Where("tenant_id = ?", tenantID).Order("updated_at desc").Find(&mappings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar mapeamento de produtos"})
		return
	}

	c.JSON(http.StatusOK, mappings)
}

func importMarketplaceCatalogItem(tenantID uint, provider string, defaultCategoryID uint, overwriteLocal bool, item models.MarketplaceCatalogItemInput) (models.MarketplaceProductImportResult, error) {
	now := time.Now()
	settings, err := getOrCreateTenantMarketplaceSettings(tenantID)
	if err != nil {
		return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao carregar regras de marketplace: %w", err)
	}
	externalID := strings.TrimSpace(item.ExternalItemID)
	if externalID == "" {
		return models.MarketplaceProductImportResult{}, errors.New("ID externo do anuncio e obrigatorio")
	}
	title := strings.TrimSpace(item.Title)
	if title == "" {
		title = strings.TrimSpace(item.ExternalTitle)
	}
	if title == "" {
		return models.MarketplaceProductImportResult{}, errors.New("Titulo do produto e obrigatorio")
	}
	if item.Price <= 0 {
		return models.MarketplaceProductImportResult{}, errors.New("Preco do produto deve ser maior que zero")
	}

	sku := strings.TrimSpace(item.ExternalSKU)
	if sku == "" {
		sku = fmt.Sprintf("%s-%s", strings.ToUpper(provider), externalID)
	}

	var product models.Product
	action := "updated"
	productFound := false
	shouldSyncImages := false
	shouldSyncVariants := false
	shouldSyncStocks := false

	var mapping models.MarketplaceProductMapping
	if err := database.DB.Where("tenant_id = ? AND provider = ? AND external_item_id = ?", tenantID, provider, externalID).First(&mapping).Error; err == nil {
		if err := database.DB.Where("tenant_id = ? AND id = ?", tenantID, mapping.ProductID).First(&product).Error; err == nil {
			productFound = true
		}
	}
	if !productFound {
		if err := database.DB.Where("tenant_id = ? AND sku = ?", tenantID, sku).First(&product).Error; err == nil {
			productFound = true
		}
	}

	categoryID := item.CategoryID
	if categoryID == 0 {
		categoryID = defaultCategoryID
	}
	if categoryID == 0 {
		categoryID = importedMarketplaceCategoryID(tenantID, provider)
	}
	if categoryID == 0 {
		return models.MarketplaceProductImportResult{}, errors.New("Cadastre uma categoria antes de importar produtos do marketplace")
	}

	imageURL := strings.TrimSpace(item.ImageURL)
	if imageURL == "" && len(item.ColorImages) > 0 {
		imageURL = strings.TrimSpace(item.ColorImages[0].ImageURL)
	}
	if imageURL == "" {
		imageURL = "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop"
	}

	status := marketplaceImportedProductStatus(provider, productFound, item.Status, settings.NewImportedProductStatus)
	inStock := item.StockQty > 0

	if !productFound {
		action = "created"
		shouldSyncImages = true
		shouldSyncVariants = true
		shouldSyncStocks = true
		product = models.Product{
			TenantID:         tenantID,
			Title:            title,
			Slug:             marketplaceProductSlug(provider, externalID, title),
			SKU:              sku,
			Description:      strings.TrimSpace(item.Description),
			Price:            item.Price,
			ImageURL:         imageURL,
			CategoryID:       categoryID,
			Material:         defaultString(item.Material, "Material informado no marketplace"),
			LayerHeight:      defaultString(item.LayerHeight, "0.16mm"),
			PrintTime:        defaultString(item.PrintTime, "A confirmar"),
			Dimensions:       defaultString(item.Dimensions, "A confirmar"),
			Weight:           defaultString(item.Weight, "0g"),
			InStock:          inStock,
			StockQty:         item.StockQty,
			Status:           status,
			SourceProvider:   provider,
			SourceExternalID: externalID,
			SourceSyncedAt:   &now,
		}
		if err := database.DB.Create(&product).Error; err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao criar produto importado: %w", err)
		}
	} else {
		marketplaceOwnsProduct := product.SourceProvider == provider
		if normalizeProvider(provider) == "mercadolivre" {
			product.Status = status
		}
		contentSyncAllowed := settings.ContentSyncPolicy == "always" ||
			(settings.ContentSyncPolicy == "imported_only" && marketplaceOwnsProduct)
		if overwriteLocal && marketplaceOwnsProduct {
			contentSyncAllowed = true
		}
		shouldSyncImages = contentSyncAllowed
		shouldSyncVariants = contentSyncAllowed || settings.MarketplaceControlsPrice
		shouldSyncStocks = settings.MarketplaceControlsStock
		if settings.MarketplaceControlsPrice {
			product.Price = item.Price
		}
		if settings.MarketplaceControlsStock {
			product.StockQty = item.StockQty
			product.InStock = inStock
		}
		if product.SKU == "" {
			product.SKU = sku
		}
		if contentSyncAllowed {
			product.SourceProvider = provider
			product.SourceExternalID = externalID
			product.SourceSyncedAt = &now
			product.Title = title
			product.Description = strings.TrimSpace(item.Description)
			if imageURL != "" {
				product.ImageURL = imageURL
			}
			product.CategoryID = categoryID
			product.Material = defaultString(item.Material, product.Material)
			product.LayerHeight = defaultString(item.LayerHeight, product.LayerHeight)
			product.PrintTime = defaultString(item.PrintTime, product.PrintTime)
			product.Dimensions = defaultString(item.Dimensions, product.Dimensions)
			product.Weight = defaultString(item.Weight, product.Weight)
		}
		if err := database.DB.Save(&product).Error; err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao atualizar produto importado: %w", err)
		}
	}

	if shouldSyncImages {
		colorImages := item.ColorImages
		if len(colorImages) == 0 {
			colorImages = []models.ProductColorImageInput{{ColorName: "Padrao", ImageURL: imageURL, SortOrder: 0}}
		}
		if err := syncProductColorImages(tenantID, product.ID, colorImages); err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar imagens do produto importado: %w", err)
		}
	}
	if shouldSyncVariants && len(item.Variants) > 0 {
		if err := syncProductVariants(tenantID, product.ID, item.Variants); err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar variacoes do produto importado: %w", err)
		}
	}
	if shouldSyncStocks {
		colorStocks := item.ColorStocks
		if len(colorStocks) == 0 {
			colorStocks = []models.ProductColorStockInput{{ColorName: "Padrao", StockQty: item.StockQty}}
		}
		if err := syncProductColorStocks(tenantID, product.ID, colorStocks); err != nil {
			return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar estoque por cor do produto importado: %w", err)
		}
	}

	if mapping.ID == 0 {
		if err := database.DB.Where("tenant_id = ? AND provider = ? AND external_item_id = ?", tenantID, provider, externalID).First(&mapping).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			mapping = models.MarketplaceProductMapping{TenantID: tenantID, Provider: provider}
		}
	}
	mapping.ProductID = product.ID
	mapping.InternalSKU = product.SKU
	mapping.ExternalSKU = sku
	mapping.ExternalTitle = defaultString(item.ExternalTitle, title)
	mapping.ExternalItemID = externalID
	mapping.ExternalURL = strings.TrimSpace(item.ExternalURL)
	mapping.SyncStatus = "catalog_imported"
	mapping.LastSyncedAt = &now
	if err := database.DB.Save(&mapping).Error; err != nil {
		return models.MarketplaceProductImportResult{}, fmt.Errorf("erro ao salvar mapeamento do produto importado: %w", err)
	}

	withProductRelations(database.DB).First(&product, product.ID)
	database.DB.Preload("Product").First(&mapping, mapping.ID)
	return models.MarketplaceProductImportResult{Action: action, Product: product, Mapping: mapping}, nil
}

func marketplaceImportedProductStatus(provider string, productFound bool, marketplaceStatus string, newImportedProductStatus string) string {
	if normalizeProvider(provider) == "mercadolivre" {
		return "active"
	}
	if !productFound {
		return normalizeImportedProductStatus(newImportedProductStatus)
	}

	status := strings.ToLower(strings.TrimSpace(marketplaceStatus))
	if status == "" {
		return "active"
	}
	if status != "active" && status != "draft" && status != "paused" {
		return "paused"
	}
	return status
}

func importedMarketplaceCategoryID(tenantID uint, provider string) uint {
	provider = normalizeProvider(provider)
	name := "Importados do " + marketplaceLabel(provider)
	description := "Categoria criada automaticamente para produtos importados."
	if provider == mercadoLivreProvider {
		name = "Produtos 3D"
		description = "Produtos selecionados da loja."
	}
	slug := "importados-" + provider
	var category models.Category
	if err := database.DB.Where("tenant_id = ? AND slug = ?", tenantID, slug).First(&category).Error; err == nil {
		if category.Name != name || category.Description != description {
			category.Name = name
			category.Description = description
			_ = database.DB.Save(&category).Error
		}
		return category.ID
	}
	category = models.Category{TenantID: tenantID, Name: name, Slug: slug, Description: description, Icon: "shopping-bag"}
	if err := database.DB.Create(&category).Error; err != nil {
		return 0
	}
	return category.ID
}

func defaultString(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return fallback
}

func marketplaceProductSlug(provider string, externalID string, title string) string {
	base := strings.ToLower(strings.TrimSpace(title))
	var builder strings.Builder
	lastDash := false
	for _, r := range base {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if slug == "" {
		slug = "produto"
	}
	return fmt.Sprintf("%s-%s-%s", provider, externalID, slug)
}
