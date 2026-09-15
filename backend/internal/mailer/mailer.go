package mailer

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strings"
	"time"

	"az3d-backend/config"
)

type Mailer struct {
	cfg *config.Config
}

func NewMailer(cfg *config.Config) *Mailer {
	return &Mailer{cfg: cfg}
}

// SendPasswordResetEmail envia o e-mail com o link seguro de recuperação de senha.
func (m *Mailer) SendPasswordResetEmail(toEmail string, userName string, resetURL string) error {
	if strings.TrimSpace(m.cfg.SMTPHost) == "" {
		log.Printf("[MAILER MOCK] SMTP_HOST não configurado. Link de recuperação para %s (%s): %s", userName, toEmail, resetURL)
		return nil
	}

	subject := "Redefinição de Senha — AZ3D Studio"
	body := fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%%" style="max-width: 560px; background-color: #111827; border-radius: 20px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1f2937; background: linear-gradient(180deg, #162032 0%%, #111827 100%%);">
              <div style="display: inline-block; font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">
                AZ<span style="color: #22d3ee; font-family: monospace;">3D</span> <span style="font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px;">Studio</span>
              </div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 800; color: #ffffff; text-align: center;">
                Recuperação de Senha
              </h1>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #cbd5e1; text-align: left;">
                Olá, <strong style="color: #ffffff;">%s</strong>!
              </p>
              <p style="margin: 0 0 28px; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: left;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color: #f1f5f9;">AZ3D Studio</strong>. Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="%s" style="display: inline-block; background-color: #22d3ee; color: #090d16; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(34, 211, 238, 0.3);">
                  Redefinir Minha Senha
                </a>
              </div>

              <p style="margin: 28px 0 12px; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">
                Este link é válido por <strong style="color: #cbd5e1;">30 minutos</strong>. Se você não solicitou esta redefinição, fique tranquilo: nenhuma alteração foi realizada e sua conta continua segura.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #475569; word-break: break-all; text-align: center;">
                Caso o botão não funcione, copie e cole o link no seu navegador:<br>
                <a href="%s" style="color: #38bdf8; text-decoration: underline;">%s</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                © %d AZ3D Studio — Plataforma de Impressão 3D e Manufatura sob Demanda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, userName, resetURL, resetURL, resetURL, time.Now().Year())

	return m.sendMail(toEmail, subject, body)
}

func (m *Mailer) sendMail(toEmail string, subject string, htmlBody string) error {
	host := strings.TrimSpace(m.cfg.SMTPHost)
	port := m.cfg.SMTPPort
	if port <= 0 {
		port = 587
	}
	addr := fmt.Sprintf("%s:%d", host, port)

	from := strings.TrimSpace(m.cfg.SMTPFrom)
	if from == "" {
		from = "AZ3D Studio <nao-responda@az3dstudio.com.br>"
	}

	fromAddress := from
	if idx := strings.Index(from, "<"); idx >= 0 && strings.HasSuffix(from, ">") {
		fromAddress = strings.Trim(from[idx+1:len(from)-1], " ")
	}

	header := make(map[string]string)
	header["From"] = from
	header["To"] = toEmail
	header["Subject"] = subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/html; charset=UTF-8"
	header["Date"] = time.Now().Format(time.RFC1123Z)

	message := ""
	for k, v := range header {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	timeout := time.Duration(m.cfg.HTTPWriteTimeout) * time.Second
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	tlsConfig := &tls.Config{
		ServerName: host,
	}

	isDirectTLS := m.cfg.SMTPTLSMode == "ssl" || m.cfg.SMTPTLSMode == "tls" || port == 465

	if isDirectTLS {
		dialer := &net.Dialer{Timeout: timeout}
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("falha ao conectar TLS no servidor SMTP %s: %w", addr, err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, host)
		if err != nil {
			return fmt.Errorf("falha ao criar cliente SMTP: %w", err)
		}
		defer client.Close()

		if m.cfg.SMTPUser != "" && m.cfg.SMTPPassword != "" {
			auth := smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPassword, host)
			if err := client.Auth(auth); err != nil {
				return fmt.Errorf("falha na autenticacao SMTP (SSL): %w", err)
			}
		}

		if err := client.Mail(fromAddress); err != nil {
			return fmt.Errorf("erro no comando MAIL FROM: %w", err)
		}
		if err := client.Rcpt(toEmail); err != nil {
			return fmt.Errorf("erro no comando RCPT TO: %w", err)
		}

		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("erro ao abrir fluxo DATA no SMTP: %w", err)
		}
		if _, err := w.Write([]byte(message)); err != nil {
			return fmt.Errorf("erro ao escrever mensagem no SMTP: %w", err)
		}
		if err := w.Close(); err != nil {
			return fmt.Errorf("erro ao fechar mensagem no SMTP: %w", err)
		}
		return client.Quit()
	}

	// STARTTLS / Plain fallback
	dialer := &net.Dialer{Timeout: timeout}
	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("falha ao conectar no servidor SMTP %s: %w", addr, err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("falha ao criar cliente SMTP: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok && m.cfg.SMTPTLSMode != "none" {
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("falha ao iniciar STARTTLS com %s: %w", host, err)
		}
	}

	if m.cfg.SMTPUser != "" && m.cfg.SMTPPassword != "" {
		auth := smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPassword, host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("falha na autenticacao SMTP: %w", err)
		}
	}

	if err := client.Mail(fromAddress); err != nil {
		return fmt.Errorf("erro no comando MAIL FROM: %w", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("erro no comando RCPT TO: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("erro ao abrir fluxo DATA: %w", err)
	}
	if _, err := w.Write([]byte(message)); err != nil {
		return fmt.Errorf("erro ao escrever dados do e-mail: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("erro ao finalizar dados do e-mail: %w", err)
	}

	return client.Quit()
}
