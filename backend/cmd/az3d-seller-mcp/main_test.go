package main

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestRunWithoutTenantDoesNotStartOrPanic(t *testing.T) {
	var output bytes.Buffer
	err := run(context.Background(), nil, strings.NewReader(""), &output, &output)
	if err == nil || !strings.Contains(err.Error(), "--tenant-id") {
		t.Fatalf("expected tenant-id validation, got %v", err)
	}
}

func TestHelpDocumentsTenantSelection(t *testing.T) {
	var output bytes.Buffer
	if err := run(context.Background(), []string{"help"}, strings.NewReader(""), &output, &output); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output.String(), "--tenant-id") {
		t.Fatalf("help must document tenant selection: %q", output.String())
	}
}
