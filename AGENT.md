# AGENT.md

Instrucoes para agentes trabalhando neste repositorio.

## Contexto Do Projeto

AZ3D e uma plataforma multi-tenant para lojas de produtos de impressao 3D. O MVP atual e:

- tenant por URL;
- store publica;
- catalogo/produtos/estoque;
- login Google para comprador/admin/tenant;
- carrinho e checkout Mercado Pago;
- painel admin;
- integracoes base com marketplaces;
- conta master `master_admin`;
- transportadoras/tracking Correios por tenant;
- Docker e CI.

Tracking e modulo opcional por tenant. A consulta Correios exige credenciais validas do tenant no CWS e objetos vinculados ao contrato/remetente.

## Regras De Trabalho

- Manter mudancas pequenas e alinhadas ao escopo do MVP.
- Preferir padroes existentes do projeto.
- Nao reverter alteracoes do usuario.
- Nao versionar segredos nem editar `backend/.env` para valores reais.
- Atualizar `backend/.env.example` quando criar nova variavel de ambiente.
- Atualizar `docker-compose.yml` quando a variavel for necessaria em container.
- Depois de mexer em Go, rodar `gofmt`.
- Antes de concluir mudancas de codigo, validar com os comandos abaixo.

## Comandos

Backend:

```bash
cd backend
go test ./...
go build ./...
```

Frontend:

```bash
cd frontend
npm run build
```

Docker:

```bash
docker compose config
```

## Arquitetura

Backend:

- `backend/main.go`: router, CORS, middlewares e rotas.
- `backend/config`: carregamento de envs.
- `backend/database`: conexao, migration e seed.
- `backend/models`: entidades e inputs.
- `backend/handlers`: HTTP handlers.
- `backend/middleware`: auth/admin middleware.
- `backend/internal/marketplaces`: conectores de marketplace.
- `backend/internal/carriers`: contratos e conectores de transportadora.
- contas de transportadora ficam em `tenant_carrier_accounts`, com credenciais criptografadas.

Frontend:

- `frontend/src/apps/store`: app da store.
- `frontend/src/apps/admin`: app admin.
- `frontend/src/components`: UI compartilhada.
- `frontend/src/context`: auth/cart.
- `frontend/src/services/api.ts`: cliente HTTP.
- `frontend/src/types`: contratos TypeScript.

## Pagamento

Visitante pode navegar na store, mas adicionar ao carrinho exige `customer` autenticado. O `CartContext` dispara `az3d:require-login` quando a tentativa vem de visitante ou role diferente de comprador.

Checkout usa Mercado Pago Checkout Pro:

- Pedido nasce como `pending_payment`.
- Backend cria preference no Mercado Pago.
- Frontend redireciona para `checkout_url`.
- Webhook `POST /api/webhooks/payments/mercadopago` atualiza status.
- Pagamento aprovado vira `paid`.
- Pagamento rejeitado/cancelado vira `cancelled` e libera estoque.

Env relevante:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_API_BASE_URL`
- `FRONTEND_BASE_URL`
- `API_PUBLIC_BASE_URL`

## Login Google

Rotas:

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`

Fluxo:

- Backend usa Authorization Code Flow.
- `state` e assinado com `JWT_SECRET` e carrega `scope`, `tenant_id`, `return_to` e `store_name`.
- `scope=customer` cria/entra comprador no tenant ativo.
- `scope=admin` so entra se o e-mail ja existir como `admin`, `tenant_admin` ou `master_admin`.
- `scope=seller` cria tenant e usuario `tenant_admin` quando o e-mail ainda nao existe.
- Frontend consome `/auth/google/callback#token=...` antes de montar o `AuthProvider`.

Nao retornar token Google ou segredo OAuth em respostas. O frontend so recebe JWT AZ3D.

## Segurança

Ao mexer em seguranca, preservar ou melhorar:

- `JWT_SECRET` forte em producao.
- `JWT_TTL_HOURS`.
- `REQUIRE_STRONG_SECRETS`.
- `CORS_ALLOWED_ORIGINS`.
- `TRUSTED_PROXIES`.
- `MAX_UPLOAD_MB`.
- `CREDENTIAL_ENCRYPTION_KEY`.
- `GOOGLE_OAUTH_CLIENT_ID`.
- `GOOGLE_OAUTH_CLIENT_SECRET`.
- `GOOGLE_OAUTH_REDIRECT_URL`.
- `CORREIOS_API_BASE_URL`.
- `CORREIOS_TOKEN_BASE_URL`.
- `TRACKING_SYNC_INTERVAL_MINUTES`.
- validacao de webhook Mercado Pago.
- protecao de rotas admin por role.
- role `master_admin` pode selecionar tenant via `X-Tenant-ID`; `tenant_admin` nao deve escapar do tenant do JWT.

Evitar:

- CORS aberto em producao.
- token hardcoded.
- retorno de dados sensiveis em JSON.
- upload sem limite ou sem extensao permitida.
- retornar credenciais descriptografadas pela API.

## Admin Master E Transportadoras

Conta seedada para desenvolvimento:

```text
usuario: admin
senha: Admin@123
role: master_admin
```

Antes de producao, trocar senha e configurar `REQUIRE_STRONG_SECRETS=true`.

Transportadoras:

- `GET /api/admin/carrier-accounts`
- `POST /api/admin/carrier-accounts`
- `PATCH /api/admin/carrier-accounts/:id/toggle`
- `GET /api/admin/carrier-health`
- `GET /api/admin/shipments`
- `POST /api/admin/shipments`
- `POST /api/admin/shipments/:id/sync`
- `POST /api/admin/shipments/sync`

Payload esperado para salvar:

```json
{
  "provider": "correios",
  "account_name": "Correios",
  "auth_type": "contract_credentials",
  "is_active": true,
  "sync_tracking": true,
  "credentials": {}
}
```

O campo `credentials` deve ser criptografado no backend e nunca deve voltar em respostas JSON.

Correios:

- Conector em `backend/internal/carriers/correios`.
- Aceita `access_token` pronto ou gera token pela API Token com `token_username` e `token_password`.
- `auth_type=contract_credentials` usa `/v1/autentica/contrato`.
- `auth_type=posting_card` usa `/v1/autentica/cartaopostagem`.
- O sync salva novos `shipment_events`, atualiza `order_shipments` e marca o pedido como `delivered` quando o envio for entregue.
- Job automatico so roda quando `TRACKING_SYNC_INTERVAL_MINUTES > 0`.

## UX/Produto

Store deve ser orientada a compra de produto pronto:

- textos comerciais;
- estoque claro;
- produto sem estoque com botao desabilitado;
- checkout claro;
- status sem prometer rastreio.

Admin deve ser operacional e direto:

- produtos;
- estoque;
- pedidos;
- precificacao;
- marketplaces.
- transportadoras;
- rastreio por pedido quando houver envio vinculado.

## Graphify

Se `graphify-out/graph.json` existir e a tarefa for uma pergunta sobre arquitetura/conteudo do codigo, consultar o grafo primeiro:

```bash
graphify query "pergunta"
```

Use o grafo como apoio, mas confirme nos arquivos reais antes de editar.
