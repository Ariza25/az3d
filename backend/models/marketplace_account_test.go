package models

import "testing"

func TestMarketplaceAccountCredentialHooksEncryptAndDecryptTokens(t *testing.T) {
	t.Setenv("CREDENTIAL_ENCRYPTION_KEY", "12345678901234567890123456789012")
	account := MarketplaceAccount{
		AccessToken: "access-secret", RefreshToken: "refresh-secret", AuthCode: "auth-secret",
	}
	if err := account.BeforeSave(nil); err != nil {
		t.Fatal(err)
	}
	if account.EncryptedCredentials == "" {
		t.Fatal("credentials were not encrypted")
	}
	if account.AccessToken != "" || account.RefreshToken != "" || account.AuthCode != "" {
		t.Fatalf("plaintext credentials remained on the persisted model: %#v", account)
	}

	loaded := MarketplaceAccount{EncryptedCredentials: account.EncryptedCredentials}
	if err := loaded.AfterFind(nil); err != nil {
		t.Fatal(err)
	}
	if loaded.AccessToken != "access-secret" || loaded.RefreshToken != "refresh-secret" || loaded.AuthCode != "auth-secret" {
		t.Fatalf("credentials were not restored after load: %#v", loaded)
	}
}
