package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"az3d-backend/internal/marketplaces/crawler"
	"az3d-backend/models"

	"gorm.io/gorm"
)

type TrendsWorker struct {
	db        *gorm.DB
	mu        sync.Mutex
	isRunning bool
	lastRun   time.Time
}

var (
	globalWorker *TrendsWorker
	once         sync.Once
)

func InitTrendsWorker(db *gorm.DB) *TrendsWorker {
	once.Do(func() {
		globalWorker = &TrendsWorker{
			db: db,
		}
	})
	return globalWorker
}

func GetGlobalWorker() *TrendsWorker {
	return globalWorker
}

// RefreshAll scrapes and updates trending keywords for all marketplaces in DB
func (w *TrendsWorker) RefreshAll(ctx context.Context, meliToken string) error {
	w.mu.Lock()
	if w.isRunning {
		w.mu.Unlock()
		return fmt.Errorf("atualização de tendências já está em andamento")
	}
	w.isRunning = true
	w.mu.Unlock()

	defer func() {
		w.mu.Lock()
		w.isRunning = false
		w.lastRun = time.Now()
		w.mu.Unlock()
	}()

	log.Printf("[TrendsWorker] Iniciando coleta de tendências em tempo real...")

	// 1. Shopee Trends
	shopeeTrends, err := crawler.FetchShopeeTrends(ctx, "all")
	if err == nil && len(shopeeTrends) > 0 {
		w.persistTrends("shopee", shopeeTrends)
		log.Printf("[TrendsWorker] Shopee: %d termos atualizados", len(shopeeTrends))
	} else if err != nil {
		log.Printf("[TrendsWorker] Erro ao buscar Shopee trends: %v", err)
	}

	// 2. Mercado Livre Trends
	meliTrends, err := crawler.FetchMercadoLivreTrends(ctx, "all", meliToken)
	if err == nil && len(meliTrends) > 0 {
		w.persistTrends("mercadolivre", meliTrends)
		log.Printf("[TrendsWorker] Mercado Livre: %d termos atualizados", len(meliTrends))
	} else if err != nil {
		log.Printf("[TrendsWorker] Erro ao buscar Mercado Livre trends: %v", err)
	}

	return nil
}

func (w *TrendsWorker) persistTrends(provider string, trends []crawler.TrendingKeyword) {
	if w.db == nil {
		return
	}

	err := w.db.Transaction(func(tx *gorm.DB) error {
		// Clear previous provider trends
		if err := tx.Where("provider = ?", provider).Delete(&models.MarketplaceTrendingKeyword{}).Error; err != nil {
			return err
		}

		now := time.Now().UTC()
		for _, t := range trends {
			trendJSON, _ := json.Marshal(t.VolumeTrend)
			record := models.MarketplaceTrendingKeyword{
				Provider:    provider,
				Keyword:     t.Keyword,
				Category:    t.Category,
				Rank:        t.Rank,
				Status:      t.Status,
				SearchVol:   t.SearchVol,
				VolumeTrend: string(trendJSON),
				URL:         t.URL,
				Score:       t.Score,
				Source:      t.Source,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		log.Printf("[TrendsWorker] Falha ao persistir tendências de %s: %v", provider, err)
	}
}

// GetCachedTrends retrieves trending keywords from DB or triggers live scrape if empty
func (w *TrendsWorker) GetCachedTrends(ctx context.Context, provider string, category string, meliToken string) ([]crawler.TrendingKeyword, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		provider = "mercadolivre"
	}

	if w.db == nil {
		if provider == "shopee" {
			return crawler.FetchShopeeTrends(ctx, category)
		}
		return crawler.FetchMercadoLivreTrends(ctx, category, meliToken)
	}

	var records []models.MarketplaceTrendingKeyword
	query := w.db.Where("provider = ?", provider)
	if category != "" && category != "all" {
		query = query.Where("LOWER(category) = ?", strings.ToLower(category))
	}

	if err := query.Order("rank ASC").Find(&records).Error; err != nil {
		return nil, err
	}

	// If empty in DB, trigger refresh once
	if len(records) == 0 {
		_ = w.RefreshAll(ctx, meliToken)
		_ = query.Order("rank ASC").Find(&records).Error
	}

	results := make([]crawler.TrendingKeyword, 0, len(records))
	for _, r := range records {
		var curve []int
		_ = json.Unmarshal([]byte(r.VolumeTrend), &curve)
		if len(curve) == 0 {
			curve = crawler.GenerateTrendCurve(r.Rank, r.Score)
		}
		results = append(results, crawler.TrendingKeyword{
			Keyword:     r.Keyword,
			Category:    r.Category,
			Rank:        r.Rank,
			Status:      r.Status,
			SearchVol:   r.SearchVol,
			VolumeTrend: curve,
			URL:         r.URL,
			Score:       r.Score,
			Source:      r.Source,
		})
	}

	if len(results) == 0 {
		if provider == "shopee" {
			return crawler.FetchShopeeTrends(ctx, category)
		}
		return crawler.FetchMercadoLivreTrends(ctx, category, meliToken)
	}

	return results, nil
}

// StartScheduled initiates background periodic crawling
func (w *TrendsWorker) StartScheduled(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 2 * time.Hour
	}
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = w.RefreshAll(ctx, "")
			}
		}
	}()
}
