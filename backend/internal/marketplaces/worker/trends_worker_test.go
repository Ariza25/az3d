package worker

import (
	"context"
	"testing"
	"time"
)

func TestTrendsWorkerNilDB(t *testing.T) {
	worker := &TrendsWorker{db: nil}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	trends, err := worker.GetCachedTrends(ctx, "shopee", "all", "")
	if err != nil {
		t.Fatalf("unexpected error with nil db: %v", err)
	}
	if len(trends) == 0 {
		t.Fatalf("expected at least 1 trend returned from fallback/live, got 0")
	}
}
