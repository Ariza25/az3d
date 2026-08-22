package middleware

import (
	"net/http"
	"strings"

	"az3d-backend/utils"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Cabeçalho de autorização não fornecido"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Formato de token inválido. Use 'Bearer <token>'"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := utils.ValidateJWT(tokenString, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token de autenticação inválido ou expirado"})
			c.Abort()
			return
		}

		// Armazena dados do usuário no contexto da requisição Gin
		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", claims.Role)
		c.Set("tenantID", claims.TenantID)

		c.Next()
	}
}

// AdminMiddleware garante que apenas usuários com role 'admin' acessem certas rotas
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("userRole")
		if !exists || (role != "admin" && role != "tenant_admin" && role != "master_admin") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Acesso negado: Requer privilégios de Administrador"})
			c.Abort()
			return
		}
		c.Next()
	}
}
