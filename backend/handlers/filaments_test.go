package handlers

import (
	"testing"
)

func TestParseWeightStringForFilaments(t *testing.T) {
	tests := []struct {
		input string
		want  float64
	}{
		{"250g", 250},
		{"180 gramas", 180},
		{"142.5g", 142.5},
		{"150,5g", 150.5},
		{"300", 300},
		{"", 0},
	}

	for _, tt := range tests {
		got := parseWeightString(tt.input)
		if got != tt.want {
			t.Errorf("parseWeightString(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestOrderFilamentSufficiencyCalculation(t *testing.T) {
	// 2 units of 150g = 300g
	unitWeight := parseWeightString("150g")
	qty := 2
	totalRequired := unitWeight * float64(qty)

	if totalRequired != 300 {
		t.Fatalf("totalRequired = %v, want 300", totalRequired)
	}

	// Case 1: Spool has 450g (sufficient)
	spoolRemaining := 450.0
	isSufficient := spoolRemaining >= totalRequired
	if !isSufficient {
		t.Errorf("expected spool with 450g to be sufficient for 300g")
	}

	// Case 2: Spool has 180g (insufficient)
	spoolRemaining = 180.0
	isSufficient = spoolRemaining >= totalRequired
	if isSufficient {
		t.Errorf("expected spool with 180g to be insufficient for 300g")
	}
	missing := totalRequired - spoolRemaining
	if missing != 120 {
		t.Errorf("expected missing to be 120, got %v", missing)
	}
}
