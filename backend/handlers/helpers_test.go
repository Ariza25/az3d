package handlers

import (
	"errors"
	"testing"
)

func TestIsDuplicateKeyError(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errors.New("record not found"), false},
		{errors.New("ERROR: duplicate key value violates unique constraint \"idx_categories_slug\" (SQLSTATE 23505)"), true},
		{errors.New("pq: duplicate key value violates unique constraint \"categories_name_key\""), true},
		{errors.New("UNIQUE constraint failed: categories.name"), true},
		{errors.New("key already exists"), true},
	}

	for _, tt := range tests {
		got := isDuplicateKeyError(tt.err)
		if got != tt.want {
			t.Errorf("isDuplicateKeyError(%v) = %v, want %v", tt.err, got, tt.want)
		}
	}
}

func TestIsForeignKeyError(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errors.New("record not found"), false},
		{errors.New("ERROR: update or delete on table \"products\" violates foreign key constraint \"orders_product_id_fkey\" on table \"order_items\" (SQLSTATE 23503)"), true},
		{errors.New("FOREIGN KEY constraint failed"), true},
	}

	for _, tt := range tests {
		got := isForeignKeyError(tt.err)
		if got != tt.want {
			t.Errorf("isForeignKeyError(%v) = %v, want %v", tt.err, got, tt.want)
		}
	}
}
