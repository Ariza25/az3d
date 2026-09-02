import { expect, test } from '@playwright/test';

const productImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#1f2a36"/>
        <stop offset="1" stop-color="#091015"/>
      </linearGradient>
    </defs>
    <rect width="800" height="800" fill="url(#bg)"/>
    <circle cx="610" cy="175" r="190" fill="#22d3ee" opacity=".16"/>
    <path d="M210 570 C280 220 440 210 540 570 C470 480 370 470 310 570 Z" fill="none" stroke="#f8fafc" stroke-width="54" stroke-linecap="round"/>
  </svg>
`)}`;

const tenant = { id: 1, name: 'AZ3D', slug: 'az3d' };
const categories = [
  { id: 1, name: 'Organização', slug: 'organizacao', description: '', icon: 'wrench' },
];
const products = [
  {
    id: 1,
    tenant_id: 1,
    title: 'Suporte escultural para celular',
    slug: 'suporte-escultural-celular',
    sku: 'AZ3D-001',
    description: 'Peça funcional com acabamento limpo e curvas suaves.',
    price: 79.9,
    image_url: productImage,
    color_images: [{ color_name: 'Branco', image_url: productImage, sort_order: 0 }],
    color_stocks: [{ color_name: 'Branco', stock_qty: 7 }],
    category_id: 1,
    category: categories[0],
    material: 'PLA Premium',
    layer_height: '0.16 mm',
    print_time: '8 horas',
    dimensions: '120 × 120 × 150 mm',
    weight: '180 g',
    in_stock: true,
    stock_qty: 7,
    status: 'active',
  },
  {
    id: 2,
    tenant_id: 1,
    title: 'Organizador modular de mesa',
    slug: 'organizador-modular',
    sku: 'AZ3D-002',
    description: 'Módulos compactos para manter acessórios sempre ao alcance.',
    price: 54.5,
    image_url: productImage,
    color_images: [{ color_name: 'Cinza', image_url: productImage, sort_order: 0 }],
    color_stocks: [{ color_name: 'Cinza', stock_qty: 4 }],
    category_id: 1,
    category: categories[0],
    material: 'PETG',
    layer_height: '0.2 mm',
    print_time: '5 horas',
    dimensions: '180 × 90 × 80 mm',
    weight: '220 g',
    in_stock: true,
    stock_qty: 4,
    status: 'active',
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8080/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};

    if (url.pathname === '/api/tenants') body = [tenant];
    else if (url.pathname.startsWith('/api/tenants/')) body = tenant;
    else if (url.pathname === '/api/categories') body = categories;
    else if (url.pathname === '/api/products') body = products;
    else if (url.pathname === '/api/tenant/settings') {
      body = {
        tenant_id: 1,
        store_name: 'AZ3D Studio',
        primary_color: '#22d3ee',
        delivery_ship_enabled: true,
        delivery_pickup_enabled: true,
      };
    } else if (url.pathname === '/api/auth/me') {
      body = {
        id: 12,
        tenant_id: 1,
        name: 'Matheus',
        email: 'matheus@example.com',
        role: 'customer',
        created_at: '2026-01-10T10:00:00Z',
      };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
});

test('mostra um estado vazio orientado para a próxima ação', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir carrinho de vendas' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Seu carrinho', exact: true })).toBeVisible();
  await expect(dialog.getByText('Seu carrinho está vazio')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Explorar catálogo' })).toBeVisible();

  await page.screenshot({
    path: `test-results/playwright/cart-empty-${testInfo.project.name}.png`,
    fullPage: false,
  });
});

test('permite revisar itens e avança para entrega sem sobrecarregar o drawer', async ({ page }, testInfo) => {
  await page.addInitScript(({ seededCart }) => {
    localStorage.setItem('az3d_tenant_id', '1');
    localStorage.setItem('az3d_customer_token', 'visual-test-token');
    localStorage.setItem('az3d_cart_tenant_1', JSON.stringify(seededCart));
  }, {
    seededCart: [
      { product: products[0], quantity: 1, color: 'Branco' },
      { product: products[1], quantity: 2, color: 'Cinza' },
    ],
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir meus pedidos' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir carrinho de vendas' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('3 itens', { exact: true })).toBeVisible();
  await expect(dialog.getByText('R$ 188,90', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Nome de quem recebe')).toHaveCount(0);

  await page.screenshot({
    path: `test-results/playwright/cart-items-${testInfo.project.name}.png`,
    fullPage: false,
  });

  await dialog.getByRole('button', { name: 'Aumentar quantidade de Suporte escultural para celular' }).click();
  await expect(dialog.getByText('R$ 268,80', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Remover Organizador modular de mesa' }).click();
  await expect(dialog.getByText('Organizador modular de mesa')).toHaveCount(0);
  await expect(dialog.getByText('R$ 159,80', { exact: true })).toHaveCount(2);

  await dialog.getByRole('button', { name: 'Continuar para entrega' }).click();
  await expect(dialog.getByRole('heading', { name: 'Entrega e contato' })).toBeVisible();
  await expect(dialog.getByLabel('Nome de quem recebe')).toBeVisible();
  await expect(dialog.getByLabel('Endereço completo')).toBeVisible();
  await expect(dialog.getByText('Suporte escultural para celular')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Ir para o pagamento' })).toBeVisible();

  await page.screenshot({
    path: `test-results/playwright/cart-delivery-${testInfo.project.name}.png`,
    fullPage: false,
  });

  const hasHorizontalOverflow = await dialog.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);

  await dialog.getByLabel('Nome de quem recebe').fill('Matheus');
  await dialog.getByLabel('Telefone').fill('11999999999');
  await dialog.getByLabel('CEP').fill('01001000');
  await dialog.getByLabel('Cidade').fill('Sao Paulo');
  await dialog.getByLabel('UF').fill('SP');
  await dialog.getByLabel('Endereço completo').fill('Praca da Se, 1');

  // Simula a limpeza do storage depois que a sessao ja foi carregada. O checkout
  // deve usar o token mantido pelo AuthContext e nunca enviar um pedido anonimo.
  await page.evaluate(() => localStorage.removeItem('az3d_customer_token'));
  const orderRequestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/orders');
  await dialog.getByRole('button', { name: 'Ir para o pagamento' }).click();
  const orderRequest = await orderRequestPromise;

  expect(orderRequest.headers()['authorization']).toBe('Bearer visual-test-token');
  expect(orderRequest.headers()['x-tenant-id']).toBe('1');
});
