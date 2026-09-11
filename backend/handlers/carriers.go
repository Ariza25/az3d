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

	for i := range accounts {
		if accounts[i].EncryptedCredentials != "" && h.cfg.CredentialEncryptionKey != "" {
			if decrypted, err := utils.DecryptString(accounts[i].EncryptedCredentials, h.cfg.CredentialEncryptionKey); err == nil {
				var creds map[string]any
				if json.Unmarshal([]byte(decrypted), &creds) == nil {
					safeCreds := make(map[string]any)
					for k, v := range creds {
						if k == "access_token" || k == "token_password" || k == "token" {
							if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
								safeCreds[k] = "••••••••"
							}
						} else {
							safeCreds[k] = v
						}
					}
					accounts[i].Settings = safeCreds
				}
			}
		}
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
		authType = "bearer_token"
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

	// Recuperar credenciais existentes para mesclagem se necessário
	existingCreds := make(map[string]any)
	if account.EncryptedCredentials != "" && h.cfg.CredentialEncryptionKey != "" {
		if decrypted, err := utils.DecryptString(account.EncryptedCredentials, h.cfg.CredentialEncryptionKey); err == nil {
			_ = json.Unmarshal([]byte(decrypted), &existingCreds)
		}
	}

	credsToSave := make(map[string]any)
	for k, v := range existingCreds {
		credsToSave[k] = v
	}

	if input.Credentials != nil {
		for k, v := range input.Credentials {
			strVal, isStr := v.(string)
			if isStr {
				strVal = strings.TrimSpace(strVal)
				if strVal == "" || strings.HasPrefix(strVal, "••••") {
					// Manter valor anterior se mascarado ou vazio
					continue
				}
				credsToSave[k] = strVal
			} else {
				credsToSave[k] = v
			}
		}
	}

	if clean := cleanCEP(input.OriginCEP); clean != "" {
		credsToSave["origin_cep"] = clean
	}

	var encryptedCredentials string
	if len(credsToSave) > 0 {
		raw, err := json.Marshal(credsToSave)
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

	account.AccountName = firstNonEmpty(input.AccountName, carrierLabel(provider))
	account.AuthType = authType
	account.IsActive = input.IsActive
	account.SyncTracking = input.SyncTracking
	if clean := cleanCEP(input.OriginCEP); clean != "" {
		account.OriginCEP = clean
		var fulfillment models.TenantFulfillmentSettings
		if err := database.DB.Where("tenant_id = ?", tenantID).First(&fulfillment).Error; err == nil {
			fulfillment.OriginCEP = clean
			_ = database.DB.Save(&fulfillment).Error
		}
	}
	if encryptedCredentials != "" {
		account.EncryptedCredentials = encryptedCredentials
		account.IsConnected = true
		account.LastError = ""
	}

	if err := database.DB.Save(&account).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar conta de transportadora"})
		return
	}

	// Adicionar settings na resposta sanitizada
	safeSettings := make(map[string]any)
	for k, v := range credsToSave {
		if k == "access_token" || k == "token_password" || k == "token" {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				safeSettings[k] = "••••••••"
			}
		} else {
			safeSettings[k] = v
		}
	}
	account.Settings = safeSettings

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
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "superfrete":
		return "SuperFrete (Correios)"
	case "correios":
		return "Correios"
	default:
		return provider
	}
}

func cleanCEP(val string) string {
	digits := ""
	for _, ch := range val {
		if ch >= '0' && ch <= '9' {
			digits += string(ch)
		}
	}
	return digits
}

