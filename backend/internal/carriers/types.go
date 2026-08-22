package carriers

import (
	"context"
	"time"
)

type TrackingEvent struct {
	Code        string
	Description string
	Location    string
	OccurredAt  time.Time
}

type TrackingResult struct {
	Status string
	Events []TrackingEvent
}

type Connector interface {
	Track(ctx context.Context, trackingCode string) (*TrackingResult, error)
}
