# AZ3D

Plataforma multi-tenant para lojas/oficinas venderem produtos de impressao 3D em loja propria, com catalogo, estoque, checkout via Mercado Pago e base para integracoes com marketplaces.

## Escopo Do MVP

O foco atual do projeto e:

- Tenant por loja, com slug em URL como `/az3d/store` ou outro tenant real cadastrado.
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

DATABASE_URL=
DATABASE_REQUIRED=true
ADM_LOGIN=
ADM_PASSWORD=
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

- `DATABASE_URL` com a connection string PostgreSQL do Neon. Use `DATABASE_REQUIRED=false` apenas para publicar o container antes de conectar o banco.
- `ADM_LOGIN` e `ADM_PASSWORD` juntos para criar ou sincronizar a conta `master_admin`; use Secret Manager para a senha e no minimo 16 caracteres.
- `JWT_SECRET` com 32+ caracteres.
- `REQUIRE_STRONG_SECRETS=true`.
- `CREDENTIAL_ENCRYPTION_KEY` com 32+ caracteres para criptografar credenciais por tenant.
- `CORS_ALLOWED_ORIGINS` apenas com os dominios reais.
- `FRONTEND_BASE_URL` com a URL publica da loja.
- `API_PUBLIC_BASE_URL` com a URL publica da API, usada no webhook do Mercado Pago.
- Configurar Client ID, Client Secret, Redirect URI e secret do webhook do Mercado Pago no painel master. Os tokens dos lojistas sao obtidos por OAuth e armazenados criptografados no banco.
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

A store/admin ficam em `http://localhost:5173`. Cada loja publica usa URL propria por slug, por exemplo `http://localhost:5173/az3d/store`.

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

1. O `master_admin` configura a aplicacao Mercado Pago em **Configuracoes**, sem access token global em env.
2. Cada tenant conecta a propria conta Mercado Pago por OAuth com `state` e PKCE.
3. Cliente fecha o carrinho e o backend cria o pedido como `pending_payment`.
4. O backend cria a preference usando exclusivamente o access token daquele tenant.
5. O frontend redireciona para o Checkout Pro, onde ficam disponiveis Pix e cartao conforme a conta do vendedor.
6. Mercado Pago chama `POST /api/webhooks/payments/mercadopago/{tenant_id}`.
7. O backend valida a assinatura, consulta o pagamento com a credencial do mesmo tenant e atualiza o pedido.

O Redirect URI cadastrado na aplicacao Mercado Pago deve ser exatamente `https://SEU-DOMINIO-DA-API/api/payments/mercadopago/oauth/callback`. O valor da venda e processado na conta Mercado Pago conectada pelo tenant; o AZ3D nao aplica comissao de marketplace no MVP.

Status internos principais:

- `pending_payment`: aguardando pagamento.
- `paid`: pagamento aprovado.
- `preparing`: em preparo.
- `delivered`: concluido.
- `cancelled`: cancelado.

## Conta Master

Em desenvolvimento, o bootstrap inicial cria uma conta master para operar a plataforma:

```text
usuario: admin
senha: Admin@123
role: master_admin
```

O `master_admin` pode alternar tenant no admin e operar usando `X-Tenant-ID`. Contas `tenant_admin` continuam presas ao tenant do proprio JWT.

Em producao, contas padrao nao sao criadas. Se uma instalacao anterior ainda tiver uma dessas senhas padrao, o backend a substitui por uma senha aleatoria antes de aceitar requisicoes.

## Conta Tenant Inicial

Em desenvolvimento, o bootstrap tambem cria uma unica conta administrativa do tenant `az3d`:

```text
email: teste@gmail.com
senha: Teste@123
role: tenant_admin
```

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

### AZ3D Seller MCP (Mercado Livre)

O backend inclui um servidor MCP local em Go que usa o conector oficial da API do Mercado Livre. A primeira versao e propositalmente somente leitura e expoe quatro ferramentas:

- `meli_connection_status`: valida a conta configurada;
- `meli_list_items`: lista ate 50 anuncios ativos;
- `meli_list_orders`: lista pedidos pagos recentes sem dados pessoais do comprador;
- `meli_sales_summary`: percorre todas as paginas do periodo e resume faturamento, taxas, frete, descontos e unidades vendidas.

Nos dados financeiros, `gross_amount` e a soma de `unit_price * quantity`, `marketplace_fees` usa a tarifa total dos pagamentos (com `sale_fee` apenas como fallback), `shipping_cost` vem de `senders[].cost` em `/shipments/{id}/costs` e `discount_amount` informa a parcela de descontos financiada pelo vendedor. Como `unit_price` ja reflete o desconto aplicado, o desconto nao e subtraido novamente de `net_amount`. Cada pedido informa `financial_complete`; o resumo informa quantos pedidos ficaram sem algum detalhe opcional da API.

O OAuth faz parte da propria plataforma multi-tenant. Nao configure `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`, access token ou refresh token no ambiente do MCP:

1. o `master_admin` abre **Ambiente e variaveis** e salva Client ID, Client Secret e Redirect URI da aplicacao global;
2. na **Visao da plataforma**, escolhe o tenant e clica em **Mercado Livre**;
3. o titular entra no Mercado Livre e concede acesso a propria conta;
4. o callback valida `state` de uso unico e PKCE S256, troca o code e salva os tokens criptografados em `marketplace_accounts` para aquele `tenant_id`;
5. o MCP le essa mesma conta no banco e renova o token no mesmo registro, sem onboarding ou token store paralelo.

No DevCenter do Mercado Livre:

1. crie ou ajuste uma aplicacao exclusiva para Mercado Livre (separada de Mercado Pago);
2. cadastre exatamente a Redirect URI exibida/salva no painel master, apontando para `/api/marketplaces/mercadolivre/oauth/callback`;
3. habilite PKCE e as permissoes funcionais necessarias;
4. autorize usando a conta administradora da loja, nao um operador/colaborador.

O MCP ainda expoe apenas operacoes de leitura, mesmo que a aplicacao ja tenha permissao de leitura e escrita para as etapas futuras. `CREDENTIAL_ENCRYPTION_KEY` continua obrigatoria na plataforma para proteger credenciais globais e grants dos tenants.

Para gerar uma chave local forte no PowerShell:

```powershell
$az3dKeyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($az3dKeyBytes)
[Convert]::ToBase64String($az3dKeyBytes)
```

Compile o executavel:

```powershell
cd backend
go build -o .\bin\az3d-seller-mcp.exe .\cmd\az3d-seller-mcp
```

Depois de autorizar o tenant no painel, valide a primeira chamada real em `GET /users/me`:

```powershell
.\bin\az3d-seller-mcp.exe doctor --tenant-id 1
```

Registre o STDIO server no Codex sem copiar segredos para a configuracao. Quando compilado em `backend/bin`, o executavel localiza `backend/.env` mesmo se o Codex o iniciar a partir de outro diretorio:

```powershell
codex mcp add az3d_seller -- "C:\caminho\para\az3d\backend\bin\az3d-seller-mcp.exe" serve --tenant-id 1
```

A configuracao equivalente em `~/.codex/config.toml` e:

```toml
[mcp_servers.az3d_seller]
command = "C:\\caminho\\para\\az3d\\backend\\bin\\az3d-seller-mcp.exe"
args = ["serve", "--tenant-id", "1"]
cwd = "C:\\caminho\\para\\az3d\\backend"
required = true
default_tools_approval_mode = "writes"
```

Reinicie o Codex e use `/mcp` (ou `codex mcp list` no CLI) para confirmar que `az3d_seller` iniciou e publicou as quatro ferramentas.

O transporte e STDIO: `stdout` fica reservado ao JSON-RPC do MCP e diagnosticos sao enviados apenas para `stderr`. Operacoes de escrita (publicar, alterar preco/estoque e gerenciar Ads) entrarao em uma etapa posterior, com validacao, previa, confirmacao e auditoria.

### Shopee

Para trazer os dados da Shopee para um tenant, separe duas responsabilidades:

- Plataforma AZ3D: possui o app da Shopee Open Platform e guarda `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY`.
- Tenant: apenas autoriza a propria loja via OAuth. Ele nao precisa informar `Partner ID` nem `Partner Key`.

1. Configure no backend da plataforma:

```env
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_API_BASE_URL=https://partner.shopeemobile.com
```

Essas variaveis sao da plataforma, nao do tenant. Em producao, defina tambem `CREDENTIAL_ENCRYPTION_KEY` forte para criptografar tokens OAuth das contas conectadas.

2. Reinicie o backend da plataforma.
3. Entre no admin do tenant em `/admin`.
4. Abra `Marketplaces`, selecione a conta Shopee, marque `Ativo`, `Pedidos` e `Estoque`, e salve.
5. Clique em `OAuth`, abra a URL de autorizacao e autorize a loja Shopee.
6. Use `Testar` para validar a conexao.
7. Use `Catalogo` para importar/atualizar anuncios da Shopee como produtos locais da store.
8. Use `Sync` para importar pedidos recentes da Shopee para o tenant.

Os dados ficam associados ao tenant via `tenant_id`: a conta conectada vai para `marketplace_accounts`, produtos importados viram `products` locais com mapeamento em `marketplace_product_mappings`, e pedidos externos ficam em `external_marketplace_orders`. Quando habilitado nas regras do marketplace, o pedido externo tambem gera pedido interno. Tokens OAuth ficam fora das respostas JSON e sao criptografados em `encrypted_credentials` quando `CREDENTIAL_ENCRYPTION_KEY` esta configurada.

## Admin Master, Estoque E Observabilidade

O painel admin possui uma visao de plataforma para `master_admin`, com tenants, pedidos abertos, alertas de estoque e status de contas Mercado Pago/marketplaces/Correios.

Endpoints adicionados para operacao:

- `GET /api/admin/platform/overview`: visao multi-tenant para `master_admin`.
- `GET /api/admin/stock-alerts`: produtos/cores abaixo do limite de reposicao.
- `GET /api/admin/observability/health`: healthcheck administrativo com banco, webhooks e integracoes.
- `GET /api/admin/observability/webhooks`: webhooks recentes de pagamentos e marketplaces.
- `GET /health`: healthcheck publico enxuto com status da API e banco.

Webhooks do Mercado Pago agora sao registrados em `payment_webhook_events`; webhooks de marketplaces continuam em `marketplace_webhook_events`. Logs HTTP saem em JSON para facilitar leitura em Docker, CI e agregadores de log.

## Segurança

Controles ja existentes:

- JWT com TTL configuravel.
- Trava opcional para impedir segredo JWT fraco em producao.
- Credenciais sensiveis por tenant criptografadas com `CREDENTIAL_ENCRYPTION_KEY`.
- CORS configuravel por env.
- Trusted proxies configuraveis.
- Upload de imagem com extensoes permitidas e limite de tamanho.
- Webhook Mercado Pago com assinatura validada pelo secret criptografado configurado no painel master.
- Rotas admin protegidas por JWT e role `admin`/`tenant_admin`.

Recomendacoes antes de publicar:

- Nunca versionar `backend/.env`.
- Usar secrets do GitHub/servidor para tokens e senhas.
- Usar HTTPS no frontend e na API.
- Configurar `API_PUBLIC_BASE_URL` com dominio publico acessivel pelo Mercado Pago.
- Trocar `JWT_SECRET`, `DB_PASSWORD` e tokens de marketplace.

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

## Bootstrap Inicial

O backend cria o tenant base `az3d` e as configuracoes essenciais. Contas com credenciais padrao sao criadas apenas fora de producao; em producao, senhas padrao legadas sao desativadas automaticamente.
Produtos, categorias, usuarios de exemplo e pedidos artificiais de marketplace nao sao mais criados automaticamente.
