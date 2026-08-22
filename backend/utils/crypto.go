package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

func EncryptString(plaintext string, secret string) (string, error) {
	if strings.TrimSpace(plaintext) == "" {
		return "", nil
	}
	key, err := encryptionKey(secret)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func DecryptString(encoded string, secret string) (string, error) {
	if strings.TrimSpace(encoded) == "" {
		return "", nil
	}
	key, err := encryptionKey(secret)
	if err != nil {
		return "", err
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext invalido")
	}

	nonce := raw[:gcm.NonceSize()]
	ciphertext := raw[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func encryptionKey(secret string) ([]byte, error) {
	if len(strings.TrimSpace(secret)) < 32 {
		return nil, fmt.Errorf("CREDENTIAL_ENCRYPTION_KEY nao configurada ou fraca")
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:], nil
}
