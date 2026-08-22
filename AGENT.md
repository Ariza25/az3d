# AGENT.md

Instrucoes para agentes trabalhando neste repositorio.

## Contexto Do Projeto

AZ3D e uma plataforma multi-tenant para lojas de produtos de impressao 3D. O MVP atual e:

- tenant por URL;
- store publica;
- catalogo/produtos/estoque;
- carrinho e checkout Mercado Pago;
- painel admin;
- integracoes base com marketplaces;
- Docker e CI.

Nao adicionar rastreio de entrega. O fluxo de pedido termina como `delivered`/`Concluido`, sem codigo de rastreio.

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

Frontend:

- `frontend/src/apps/store`: app da store.
- `frontend/src/apps/admin`: app admin.
- `frontend/src/components`: UI compartilhada.
- `frontend/src/context`: auth/cart.
- `frontend/src/services/api.ts`: cliente HTTP.
- `frontend/src/types`: contratos TypeScript.

## Pagamento

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

## Segurança

Ao mexer em seguranca, preservar ou melhorar:

- `JWT_SECRET` forte em producao.
- `JWT_TTL_HOURS`.
- `REQUIRE_STRONG_SECRETS`.
- `CORS_ALLOWED_ORIGINS`.
- `TRUSTED_PROXIES`.
- `MAX_UPLOAD_MB`.
- validacao de webhook Mercado Pago.
- protecao de rotas admin por role.

Evitar:

- CORS aberto em producao.
- token hardcoded.
- retorno de dados sensiveis em JSON.
- upload sem limite ou sem extensao permitida.

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

## Graphify

Se `graphify-out/graph.json` existir e a tarefa for uma pergunta sobre arquitetura/conteudo do codigo, consultar o grafo primeiro:

```bash
graphify query "pergunta"
```

Use o grafo como apoio, mas confirme nos arquivos reais antes de editar.
