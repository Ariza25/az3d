# AZ3D

Plataforma multi-tenant para lojas/oficinas venderem produtos de impressao 3D em loja propria, com catalogo, estoque, checkout via Mercado Pago e base para integracoes com marketplaces.

## Escopo Do MVP

O foco atual do projeto e:

- Tenant por loja, com slug em URL como `/loja/az3d`.
- Store publica com identidade visual do tenant.
- Catalogo de produtos, categorias, cores, estoque e favoritos.
- Login por e-mail/senha ou Google para compradores.
- Login Google para contas administrativas ja cadastradas e cadastro Google para novos tenants.
- Carrinho e checkout com Mercado Pago Checkout Pro.
- Painel admin para produtos, estoque, pedidos, precificacao e marketplaces.
- Conta master para operacao multi-tenant.
- Transportadoras por tenant com credenciais criptografadas e tracking Correios.
- Importacao/sincronizacao de marketplaces como base operacional.
- Docker Compose e CI para validar backend, frontend e imagens.

Nao faz parte do escopo atual:

- Publicacao real completa para marketplaces.
- Checkout transparente/cartao dentro da propria UI.

## Stack

- Backend: Go 1.22, Gin, GORM, PostgreSQL.
- Frontend: React 18, Vite, TypeScript, Tailwind CSS.
- Pagamento: Mercado Pago Checkout Pro via Preferences API.
- Tracking: Correios API Rastro via credenciais do tenant.
- Infra local: Docker Compose com PostgreSQL, backend e frontend Nginx.
- CI: GitHub Actions com build/test do backend, build do frontend e build das imagens Docker.

## Estrutura

```text
backend/              API Go, banco, handlers, middlewares e integracoes
frontend/             Store/admin React
.github/workflows/    CI
docker-compose.yml    Stack local/producao simples
graphify-out/         Grafo local do codigo gerado pelo graphify
```

## Variaveis De Ambiente

Use `backend/.env.example` como base para desenvolvimento local.

Principais variaveis:

```env
PORT=8080
ENV=development

DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=az3d_db
DB_PORT=5432
DB_SSLMODE=disable

JWT_SECRET=troque-por-um-segredo-forte
JWT_TTL_HOURS=168
REQUIRE_STRONG_SECRETS=false
CREDENTIAL_ENCRYPTION_KEY=

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
TRUSTED_PROXIES=127.0.0.1,::1
MAX_UPLOAD_MB=5

FRONTEND_BASE_URL=http://localhost:5173
API_PUBLIC_BASE_URL=http://localhost:8080
MERCADO_PAGO_API_BASE_URL=https://api.mercadopago.com
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:8080/api/auth/google/callback
GOOGLE_OAUTH_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
GOOGLE_OAUTH_TOKEN_URL=https://oauth2.googleapis.com/token
GOOGLE_OAUTH_USERINFO_URL=https://openidconnect.googleapis.com/v1/userinfo

CORREIOS_API_BASE_URL=https://api.correios.com.br/srorastro
CORREIOS_TOKEN_BASE_URL=https://api.correios.com.br/token
TRACKING_SYNC_INTERVAL_MINUTES=0
```

Para producao, defina:

- `JWT_SECRET` com 32+ caracteres.
- `REQUIRE_STRONG_SECRETS=true`.
- `CREDENTIAL_ENCRYPTION_KEY` com 32+ caracteres para criptografar credenciais por tenant.
- `CORS_ALLOWED_ORIGINS` apenas com os dominios reais.
- `FRONTEND_BASE_URL` com a URL publica da loja.
- `API_PUBLIC_BASE_URL` com a URL publica da API, usada no webhook do Mercado Pago.
- `MERCADO_PAGO_ACCESS_TOKEN` com token real ou sandbox.
- `MERCADO_PAGO_WEBHOOK_SECRET` com o secret configurado no painel do Mercado Pago.
- `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` com credenciais OAuth Web do Google.
- `GOOGLE_OAUTH_REDIRECT_URL` igual ao redirect autorizado no Google Cloud Console.
- `CORREIOS_API_BASE_URL` e `CORREIOS_TOKEN_BASE_URL` conforme ambiente Correios.
- `TRACKING_SYNC_INTERVAL_MINUTES` maior que zero para habilitar job automatico de rastreio.

## Rodando Localmente

### Backend

```bash
cd backend
go mod download
go run .
```

A API fica em `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

A store/admin ficam em `http://localhost:5173`.

### Docker Compose

```bash
docker compose up --build
```

Servicos:

- Frontend: `http://localhost`
- Backend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

## Checkout Mercado Pago

Visitantes podem navegar pela store, mas o carrinho exige conta de comprador. Ao clicar em adicionar produto sem estar autenticado, a UI abre o login/cadastro.

O checkout usa Mercado Pago Checkout Pro:

1. Cliente fecha o carrinho.
2. Backend cria pedido com status `pending_payment`.
3. Backend cria uma preference no Mercado Pago.
4. Frontend redireciona para `checkout_url`.
5. Mercado Pago chama `POST /api/webhooks/payments/mercadopago`.
6. Backend consulta o pagamento em `/v1/payments/{id}` e atualiza o pedido.

Status internos principais:

- `pending_payment`: aguardando pagamento.
- `paid`: pagamento aprovado.
- `preparing`: em preparo.
- `delivered`: concluido.
- `cancelled`: cancelado.

## Conta Master

O seed cria uma conta master para operar a plataforma:

```text
usuario: admin
senha: Admin@123
role: master_admin
```

O `master_admin` pode alternar tenant no admin e operar usando `X-Tenant-ID`. Contas `tenant_admin` continuam presas ao tenant do proprio JWT.

Troque essa senha antes de qualquer uso fora de desenvolvimento.

## Login Google

O login Google usa Authorization Code Flow no backend:

1. Frontend chama `GET /api/auth/google/start`.
2. Backend gera `state` assinado, monta a URL do Google e retorna `auth_url`.
3. Google chama `GET /api/auth/google/callback`.
4. Backend troca `code` por token, valida `id_token`, consulta UserInfo e emite JWT AZ3D.
5. Frontend recebe o JWT no fragmento de `/auth/google/callback` e grava no storage correto.

Escopos internos:

- `customer`: entra ou cria comprador no tenant ativo.
- `admin`: entra apenas se o e-mail ja existir como `admin`, `tenant_admin` ou `master_admin`.
- `seller`: cria tenant e usuario `tenant_admin` quando o e-mail ainda nao existe.

No Google Cloud Console, cadastre o redirect URI exatamente como `GOOGLE_OAUTH_REDIRECT_URL`.

## Transportadoras E Tracking

O admin permite cadastrar Correios por tenant, criar envios nos pedidos e sincronizar a timeline de rastreio.

Tabelas de base:

- `tenant_carrier_accounts`: credenciais/configuracoes por tenant e provider.
- `order_shipments`: envio vinculado ao pedido.
- `shipment_events`: timeline de eventos do tracking.

Endpoints admin:

- `GET /api/admin/carrier-accounts`
- `POST /api/admin/carrier-accounts`
- `PATCH /api/admin/carrier-accounts/:id/toggle`
- `GET /api/admin/carrier-health`
- `GET /api/admin/shipments`
- `POST /api/admin/shipments`
- `POST /api/admin/shipments/:id/sync`
- `POST /api/admin/shipments/sync`

Credenciais enviadas em `credentials` sao salvas criptografadas com `CREDENTIAL_ENCRYPTION_KEY` e nunca retornam descriptografadas pela API.

Exemplo de conta Correios com token pronto:

```json
{
  "provider": "correios",
  "account_name": "Correios Loja AZ3D",
  "auth_type": "bearer_token",
  "is_active": true,
  "sync_tracking": true,
  "credentials": {
    "access_token": "token-gerado-no-cws"
  }
}
```

Exemplo de conta Correios usando API Token por contrato:

```json
{
  "provider": "correios",
  "account_name": "Correios Loja AZ3D",
  "auth_type": "contract_credentials",
  "is_active": true,
  "sync_tracking": true,
  "credentials": {
    "token_username": "idCorreios",
    "token_password": "codigo-de-acesso-api",
    "contract_number": "contrato",
    "contract_dr": "10"
  }
}
```

O conector chama a API Token dos Correios quando nao houver `access_token` salvo e consulta `GET /srorastro/v1/objetos/{codigo}?resultado=T`. A API Rastro dos Correios restringe consultas a objetos vinculados ao contrato/remetente do tenant; cada tenant deve usar suas proprias credenciais autorizadas no CWS.

## Marketplaces

O painel possui base para Mercado Livre, Shopee e Amazon:

- contas/configuracoes por tenant;
- importacao/sync de produtos;
- sync de pedidos externos;
- mapeamento entre SKU/produto interno e item externo.

Para o MVP atual, a prioridade e usar os marketplaces como origem/sincronizacao e manter a store propria operando com compra via Mercado Pago.

## Segurança

Controles ja existentes:

- JWT com TTL configuravel.
- Trava opcional para impedir segredo JWT fraco em producao.
- Credenciais sensiveis por tenant criptografadas com `CREDENTIAL_ENCRYPTION_KEY`.
- CORS configuravel por env.
- Trusted proxies configuraveis.
- Upload de imagem com extensoes permitidas e limite de tamanho.
- Webhook Mercado Pago com validacao opcional de assinatura via `MERCADO_PAGO_WEBHOOK_SECRET`.
- Rotas admin protegidas por JWT e role `admin`/`tenant_admin`.

Recomendacoes antes de publicar:

- Nunca versionar `backend/.env`.
- Usar secrets do GitHub/servidor para tokens e senhas.
- Usar HTTPS no frontend e na API.
- Configurar `API_PUBLIC_BASE_URL` com dominio publico acessivel pelo Mercado Pago.
- Trocar `JWT_SECRET`, `DB_PASSWORD` e tokens de marketplace/pagamento.

## CI

O workflow `.github/workflows/ci.yml` roda:

- `go test ./...`
- `go build ./...`
- `npm ci`
- `npm run build`
- `docker build` do backend e frontend

## Comandos De Validação

```bash
cd backend
go test ./...
go build ./...

cd ../frontend
npm run build

cd ..
docker compose config
```

## Dados Demo

O backend faz seed inicial quando o banco esta vazio, criando tenants como `az3d` e `makerlab`, categorias, produtos e usuarios demo. Verifique `backend/database/db.go` para os dados de bootstrap.
