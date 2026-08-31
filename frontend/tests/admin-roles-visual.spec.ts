import { expect, Page, test } from '@playwright/test';

const tenant = { id: 1, name: 'AZ3D Studio', slug: 'az3d' };

const platformOverview = {
  tenants_count: 1,
  products_count: 12,
  orders_count: 38,
  open_orders_count: 4,
  low_stock_count: 2,
  marketplace_accounts_count: 2,
  carrier_accounts_count: 1,
  payment_gateway_configured: true,
  webhook_secret_configured: true,
  generated_at: '2026-08-28T18:00:00Z',
  tenants: [{
    tenant_id: 1,
    tenant_name: 'AZ3D Studio',
    tenant_slug: 'az3d',
    products_count: 12,
    active_products_count: 10,
    orders_count: 38,
    open_orders_count: 4,
    low_stock_count: 2,
    marketplace_accounts: 2,
    active_marketplace_count: 2,
    carrier_accounts: 1,
    active_carrier_count: 1,
    connected_carrier_count: 1,
    external_orders_count: 6,
    marketplace_errors_count: 0,
    carrier_errors_count: 0,
    last_order_at: '2026-08-28T16:20:00Z',
  }],
};

const platformEnvironment = {
  environment: 'production',
  service: 'AZ3D API',
  version: '1.0.0',
  database_required: true,
  max_upload_mb: 5,
  tracking_sync_interval_minutes: 15,
  checked_at: '2026-08-28T18:00:00Z',
  variables: [
    { key: 'DATABASE_URL', category: 'database', configured: true, required: true, description: 'Conexão principal com o banco de dados' },
    { key: 'JWT_SECRET', category: 'security', configured: true, required: true, description: 'Assinatura das sessões administrativas' },
    { key: 'CREDENTIAL_ENCRYPTION_KEY', category: 'security', configured: true, required: true, description: 'Criptografia das credenciais' },
    { key: 'GOOGLE_OAUTH', category: 'authentication', configured: false, required: false, description: 'Login administrativo via Google' },
  ],
};

const observability = {
  status: 'ok',
  database: 'online',
  scope: { all_tenants: true, tenant_id: 0 },
  failed_payment_webhooks_24h: 0,
  failed_marketplace_webhooks_24h: 1,
  marketplace_errors: 0,
  carrier_errors: 0,
  mercado_pago_configured: true,
  mercado_pago_webhook_secret: true,
  correios_base_configured: true,
  checked_at: '2026-08-28T18:00:00Z',
};

const outbox = [{
  id: 91,
  tenant_id: 1,
  provider: 'mercadopago',
  source: 'payment',
  event_type: 'payment.updated',
  external_id: 'evt_0192',
  status: 'processed',
  received_at: '2026-08-28T17:55:00Z',
  processed_at: '2026-08-28T17:55:02Z',
}];

async function mockAdmin(page: Page, role: 'master_admin' | 'tenant_admin') {
  await page.addInitScript(({ token }) => localStorage.setItem('az3d_admin_token', token), { token: `token-${role}` });

  await page.route('http://localhost:8080/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = {};

    if (path === '/api/auth/me') {
      body = {
        id: role === 'master_admin' ? 1 : 7,
        tenant_id: role === 'master_admin' ? 0 : 1,
        name: role === 'master_admin' ? 'Controlador AZ3D' : 'Gestor da loja',
        email: role === 'master_admin' ? 'master@az3d.local' : 'gestor@az3d.local',
        role,
        created_at: '2026-01-01T10:00:00Z',
      };
    } else if (path === '/api/admin/platform/overview') body = platformOverview;
    else if (path === '/api/admin/platform/environment') body = platformEnvironment;
    else if (path === '/api/admin/platform/observability') body = observability;
    else if (path === '/api/admin/platform/outbox') body = outbox;
    else if (path === '/api/admin/platform/payments/mercadopago') {
      body = { client_id: 'app-az3d', redirect_uri: 'https://api.az3d.local/callback', client_secret_configured: true, webhook_secret_configured: true };
    } else if (path === '/api/tenants') body = [tenant];
    else if (path.startsWith('/api/tenants/')) body = tenant;
    else if (path === '/api/categories' || path === '/api/products') body = [];
    else if (path === '/api/admin/tenant/settings') {
      body = {
        tenant_id: 1,
        store_name: 'AZ3D Studio',
        primary_color: '#22d3ee',
        delivery_ship_enabled: true,
        delivery_pickup_enabled: true,
      };
    } else if (path.startsWith('/api/admin/')) body = [];

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('master recebe somente o plano de controle da plataforma', async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await mockAdmin(page, 'master_admin');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Plataforma', exact: true })).toBeVisible();
  await expect(page.getByText('Control plane', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Produtos/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Pedidos/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Marketplaces/ })).toHaveCount(0);

  await page.screenshot({ path: `test-results/playwright/admin-master-${testInfo.project.name}.png`, fullPage: true });

  await page.getByRole('button', { name: /Outbox/ }).click();
  await expect(page.getByRole('heading', { name: 'Outbox de integrações' })).toBeVisible();
  await expect(page.getByText('payment.updated')).toBeVisible();

  await page.getByRole('button', { name: /Ambiente/ }).click();
  await expect(page.getByRole('heading', { name: 'Ambiente e variáveis' })).toBeVisible();
  await expect(page.getByText('DATABASE_URL', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/playwright/admin-master-environment-${testInfo.project.name}.png`, fullPage: true });

  expect(requests.some((path) => /^\/api\/admin\/(products|orders|marketplaces|tenant|stock)/.test(path))).toBe(false);
});

test('login master na rota admin abre o plano de controle sem recarregar', async ({ page }) => {
  await page.route('http://localhost:8080/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};

    if (path === '/api/auth/admin/login') {
      body = {
        token: 'token-master-login',
        user: {
          id: 1,
          tenant_id: 1,
          name: 'Controlador AZ3D',
          email: 'master@az3d.local',
          role: 'master_admin',
          created_at: '2026-01-01T10:00:00Z',
        },
      };
    } else if (path === '/api/auth/me') {
      body = {
        id: 1,
        tenant_id: 1,
        name: 'Controlador AZ3D',
        email: 'master@az3d.local',
        role: 'master_admin',
        created_at: '2026-01-01T10:00:00Z',
      };
    } else if (path === '/api/admin/platform/overview') body = platformOverview;
    else if (path === '/api/admin/platform/environment') body = platformEnvironment;
    else if (path === '/api/admin/platform/observability') body = observability;
    else if (path === '/api/admin/platform/outbox') body = outbox;
    else if (path === '/api/admin/platform/payments/mercadopago') {
      body = { client_id: '', redirect_uri: '', client_secret_configured: false, webhook_secret_configured: false };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Entrar no console' }).click();
  await page.getByPlaceholder('seu.email@exemplo.com ou admin').fill('master@az3d.local');
  await page.getByPlaceholder('********').fill('senha-segura-de-teste');
  await page.getByRole('button', { name: 'Entrar no Admin', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Plataforma', exact: true })).toBeVisible();
  await expect(page.getByText('Control plane', { exact: true })).toBeVisible();
  await expect(page.getByText('master_admin', { exact: true })).toHaveCount(1);
});

test('tenant admin recebe somente a gestão da própria loja', async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await mockAdmin(page, 'tenant_admin');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Gestão da loja' })).toBeVisible();
  await expect(page.getByText('tenant_admin', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Produtos/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Marketplaces/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Outbox/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Ambiente/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Observabilidade/ })).toHaveCount(0);

  await page.screenshot({ path: `test-results/playwright/admin-tenant-${testInfo.project.name}.png`, fullPage: true });

  await page.getByRole('button', { name: /Produtos/ }).click();
  await expect(page.getByRole('button', { name: 'Novo Produto 3D' })).toBeVisible();
  expect(requests.some((path) => path.startsWith('/api/admin/platform/'))).toBe(false);
});
