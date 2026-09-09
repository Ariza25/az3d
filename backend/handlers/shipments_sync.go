package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"az3d-backend/config"
	"az3d-backend/database"
	"az3d-backend/internal/carriers"
	"az3d-backend/internal/carriers/correios"
	"az3d-backend/models"
	"az3d-backend/utils"

	"gorm.io/gorm"
)

type trackingSyncSummary struct {
	Processed int                 `json:"processed"`
	Synced    int                 `json:"synced"`
	Failed    int                 `json:"failed"`
	Results   []trackingSyncEntry `json:"results"`
}

type trackingSyncEntry struct {
	ShipmentID    uint   `json:"shipment_id"`
	OrderID       uint   `json:"order_id"`
	Carrier       string `json:"carrier"`
	TrackingCode  string `json:"tracking_code"`
	Status        string `json:"status"`
	EventsCreated int    `json:"events_created"`
	Error         string `json:"error,omitempty"`
}

func StartTrackingSyncJob(cfg *config.Config) {
	if cfg.TrackingSyncIntervalMin <= 0 {
		return
	}
	interval := time.Duration(cfg.TrackingSyncIntervalMin) * time.Minute
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			summary := SyncActiveTracking(context.Background(), cfg, 0)
			if summary.Processed > 0 || summary.Failed > 0 {
				log.Printf("[tracking-sync] processed=%d synced=%d failed=%d", summary.Processed, summary.Synced, summary.Failed)
			}
		}
	}()
}

func SyncActiveTracking(ctx context.Context, cfg *config.Config, tenantID uint) trackingSyncSummary {
	summary := trackingSyncSummary{Results: []trackingSyncEntry{}}

	accountQuery := database.DB.Where("is_active = true AND is_connected = true AND sync_tracking = true")
	if tenantID > 0 {
		accountQuery = accountQuery.Where("tenant_id = ?", tenantID)
	}

	var accounts []models.TenantCarrierAccount
	if err := accountQuery.Find(&accounts).Error; err != nil {
		summary.Failed++
		summary.Results = append(summary.Results, trackingSyncEntry{Error: "Erro ao carregar contas de transportadora: " + err.Error()})
		return summary
	}

	for i := range accounts {
		account := accounts[i]
		var shipments []models.OrderShipment
		if err := database.DB.Where(
			"tenant_id = ? AND carrier = ? AND tracking_code <> '' AND status NOT IN ?",
			account.TenantID,
			account.Provider,
			[]string{"delivered", "cancelled"},
		).Order("last_sync_at asc NULLS FIRST, created_at asc").Find(&shipments).Error; err != nil {
			summary.Failed++
			summary.Results = append(summary.Results, trackingSyncEntry{Carrier: account.Provider, Error: err.Error()})
			continue
		}
		for j := range shipments {
			summary.Processed++
			entry := syncOneShipment(ctx, cfg, &account, &shipments[j])
			if entry.Error != "" {
				summary.Failed++
			} else {
				summary.Synced++
			}
			summary.Results = append(summary.Results, entry)
		}
	}

	return summary
}

func syncOneShipment(ctx context.Context, cfg *config.Config, account *models.TenantCarrierAccount, shipment *models.OrderShipment) trackingSyncEntry {
	entry := trackingSyncEntry{
		ShipmentID:   shipment.ID,
		OrderID:      shipment.OrderID,
		Carrier:      shipment.Carrier,
		TrackingCode: shipment.TrackingCode,
		Status:       shipment.Status,
	}

	connector, err := connectorForAccount(cfg, account)
	if err != nil {
		entry.Error = err.Error()
		setShipmentSyncError(account, shipment, err)
		return entry
	}

	result, err := connector.Track(ctx, shipment.TrackingCode)
	if err != nil {
		entry.Error = err.Error()
		setShipmentSyncError(account, shipment, err)
		return entry
	}

	created, err := persistTrackingResult(account, shipment, result)
	if err != nil {
		entry.Error = err.Error()
		setShipmentSyncError(account, shipment, err)
		return entry
	}

	entry.EventsCreated = created
	entry.Status = shipment.Status
	return entry
}

func connectorForAccount(cfg *config.Config, account *models.TenantCarrierAccount) (carriers.Connector, error) {
	credentials := map[string]any{}
	if strings.TrimSpace(account.EncryptedCredentials) == "" {
		return nil, fmt.Errorf("credenciais criptografadas ausentes")
	}

	decrypted, err := utils.DecryptString(account.EncryptedCredentials, cfg.CredentialEncryptionKey)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(decrypted), &credentials); err != nil {
		return nil, fmt.Errorf("credenciais da transportadora invalidas: %w", err)
	}
	credentials["auth_type"] = account.AuthType

	switch strings.ToLower(account.Provider) {
	case "correios":
		apiBaseURL := firstNonEmpty(stringCredential(credentials, "api_base_url"), cfg.CorreiosAPIBaseURL)
		tokenBaseURL := firstNonEmpty(stringCredential(credentials, "token_base_url"), cfg.CorreiosTokenBaseURL)
		return correios.New(apiBaseURL, tokenBaseURL, credentials), nil
	default:
		return nil, fmt.Errorf("provider de transportadora nao suportado: %s", account.Provider)
	}
}

func persistTrackingResult(account *models.TenantCarrierAccount, shipment *models.OrderShipment, result *carriers.TrackingResult) (int, error) {
	now := time.Now().UTC()
	created := 0

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		for _, event := range result.Events {
			if event.OccurredAt.IsZero() {
				event.OccurredAt = now
			}
			var count int64
			tx.Model(&models.ShipmentEvent{}).
				Where(
					"shipment_id = ? AND event_code = ? AND description = ? AND occurred_at = ?",
					shipment.ID,
					event.Code,
					event.Description,
					event.OccurredAt,
				).
				Count(&count)
			if count > 0 {
				continue
			}
			record := models.ShipmentEvent{
				TenantID:    shipment.TenantID,
				ShipmentID:  shipment.ID,
				OrderID:     shipment.OrderID,
				Carrier:     shipment.Carrier,
				EventCode:   event.Code,
				Description: event.Description,
				Location:    event.Location,
				OccurredAt:  event.OccurredAt,
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
			created++
		}

		if result.Status != "" {
			shipment.Status = result.Status
		}
		shipment.LastSyncAt = &now
		shipment.LastError = ""
		if shipment.Status != "pending" && shipment.PostedAt == nil && len(result.Events) > 0 {
			posted := oldestEventTime(result.Events)
			shipment.PostedAt = &posted
		}
		if shipment.Status == "delivered" && shipment.DeliveredAt == nil {
			delivered := newestEventTime(result.Events)
			shipment.DeliveredAt = &delivered
			if err := tx.Model(&models.Order{}).
				Where("id = ? AND tenant_id = ? AND status <> ?", shipment.OrderID, shipment.TenantID, "cancelled").
				Update("status", "delivered").Error; err != nil {
				return err
			}
		}
		if err := tx.Save(shipment).Error; err != nil {
			return err
		}

		account.LastSyncAt = &now
		account.LastError = ""
		return tx.Save(account).Error
	})

	return created, err
}

func setShipmentSyncError(account *models.TenantCarrierAccount, shipment *models.OrderShipment, err error) {
	now := time.Now().UTC()
	message := err.Error()
	database.DB.Model(shipment).Updates(map[string]any{
		"last_sync_at": now,
		"last_error":   message,
	})
	database.DB.Model(account).Updates(map[string]any{
		"last_sync_at": now,
		"last_error":   message,
	})
}

func stringCredential(values map[string]any, key string) string {
	value, ok := values[key]
	if !ok || value == nil {
		return ""
	}
	if typed, ok := value.(string); ok {
		return strings.TrimSpace(typed)
	}
	return fmt.Sprint(value)
}

func oldestEventTime(events []carriers.TrackingEvent) time.Time {
	if len(events) == 0 {
		return time.Now().UTC()
	}
	oldest := events[0].OccurredAt
	for _, event := range events[1:] {
		if event.OccurredAt.Before(oldest) {
			oldest = event.OccurredAt
		}
	}
	return oldest
}

func newestEventTime(events []carriers.TrackingEvent) time.Time {
	if len(events) == 0 {
		return time.Now().UTC()
	}
	newest := events[0].OccurredAt
	for _, event := range events[1:] {
		if event.OccurredAt.After(newest) {
			newest = event.OccurredAt
		}
	}
	return newest
}
