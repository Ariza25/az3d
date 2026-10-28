package crawler

import (
	"context"
	"testing"
	"time"
)

func TestGenerateTrendCurve(t *testing.T) {
	curve := GenerateTrendCurve(1, 0.65)
	if len(curve) != 6 {
		t.Fatalf("expected 6 points in curve, got %d", len(curve))
	}
	for _, pt := range curve {
		if pt < 20 || pt > 100 {
			t.Errorf("curve point out of bounds [20, 100]: %d", pt)
		}
	}
}

func TestFetchShopeeTrendsFallbackOrLive(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	trends, err := FetchShopeeTrends(ctx, "all")
	if err != nil {
		t.Fatalf("FetchShopeeTrends returned error: %v", err)
	}
	if len(trends) == 0 {
		t.Fatalf("expected at least 1 trend, got 0")
	}
	if trends[0].Keyword == "" {
		t.Errorf("empty keyword in first trend")
	}
	if trends[0].SearchVol <= 0 {
		t.Errorf("expected positive search volume, got %d", trends[0].SearchVol)
	}
}

func TestFetchMercadoLivreTrendsFallbackOrLive(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	trends, err := FetchMercadoLivreTrends(ctx, "all", "")
	if err != nil {
		t.Fatalf("FetchMercadoLivreTrends returned error: %v", err)
	}
	if len(trends) == 0 {
		t.Fatalf("expected at least 1 trend, got 0")
	}
	if trends[0].Keyword == "" {
		t.Errorf("empty keyword in first trend")
	}
}

func TestFetchLiveMercadoLivreSearch(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	items, total, err := FetchLiveMercadoLivreSearch(ctx, "suporte headset", "")
	if err != nil {
		t.Fatalf("FetchLiveMercadoLivreSearch error: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected at least 1 item, got 0")
	}
	if total <= 0 {
		t.Errorf("expected positive total, got %d", total)
	}
}
