package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/models"
	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CarrierHandler struct {
	cfg *config.Config
}

func NewCarrierHandler(cfg *config.Config) *CarrierHandler {
	return &CarrierHandler{cfg: cfg}
}

func (h *CarrierHandler) GetCarrierAccounts(c *gin.Context) {
	tenantID := getTenantID(c)

	var accounts []models.TenantCarrierAccount
	if err := database.DB.Where("tenant_id = ?", tenantID).Order("provider asc").Find(&accounts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao carregar contas de transportadora"})
		return
	}

	c.JSON(http.StatusOK, accounts)
}

func (h *CarrierHandler) SaveCarrierAccount(c *gin.Context) {
	tenantID := getTenantID(c)

	var input models.TenantCarrierAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados da transportadora invalidos: " + err.Error()})
		return
	}

	provider := strings.ToLower(strings.TrimSpace(input.Provider))
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Informe o provider da transportadora"})
		return
	}
	authType := strings.TrimSpace(input.AuthType)
	if authType == "" {
		authType = "contract_credentials"
	}

	var encryptedCredentials string
	if len(input.Credentials) > 0 {
		raw, err := json.Marshal(input.Credentials)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Credenciais invalidas"})
			return
		}
		encrypted, err := utils.EncryptString(string(raw), h.cfg.CredentialEncryptionKey)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		encryptedCredentials = encrypted
	}

	var account models.TenantCarrierAccount
	err := database.DB.Where("tenant_id = ? AND provider = ?", tenantID, provider).First(&account).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao consultar conta de transportadora"})
		return
	}
	if err == gorm.ErrRecordNotFound {
		account = models.TenantCarrierAccount{
			TenantID: tenantID,
			Provider: provider,
		}
	}

	account.AccountName = firstNonEmpty(input.AccountName, carrierLabel(provider))
	account.AuthType = authType
	account.IsActive = input.IsActive
	account.SyncTracking = input.SyncTracking
	if encryptedCredentials != "" {
		account.EncryptedCredentials = encryptedCredentials
		account.IsConnected = true
		account.LastError = ""
	}

	if err := database.DB.Save(&account).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar conta de transportadora"})
		return
	}

	c.JSON(http.StatusOK, account)
}

func (h *CarrierHandler) ToggleCarrierAccount(c *gin.Context) {
	tenantID := getTenantID(c)
	id := c.Param("id")

	var account models.TenantCarrierAccount
	if err := database.DB.Where("tenant_id = ?", tenantID).First(&account, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conta de transportadora nao encontrada"})
		return
	}

	account.IsActive = !account.IsActive
	if err := database.DB.Save(&account).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao alternar status da transportadora"})
		return
	}

	c.JSON(http.StatusOK, account)
}

func carrierLabel(provider string) string {
	switch provider {
	case "correios":
		return "Correios"
	default:
		return provider
	}
}
