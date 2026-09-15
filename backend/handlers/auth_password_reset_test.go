package handlers

import (
	"testing"
)

func TestMaskEmail(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"joao@gmail.com", "j**o@gmail.com"},
		{"contato@az3dstudio.com.br", "c*****o@az3dstudio.com.br"},
		{"ab@xyz.com", "ab***@xyz.com"},
		{"a@xyz.com", "a***@xyz.com"},
		{"invalidemail", "invalidemail"},
	}

	for _, tt := range tests {
		got := maskEmail(tt.input)
		if got != tt.want {
			t.Errorf("maskEmail(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
