import { expect, test } from '@playwright/test';

const productImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#16202b"/>
        <stop offset="1" stop-color="#071015"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#bg)"/>
    <circle cx="930" cy="170" r="260" fill="#22d3ee" opacity=".18"/>
    <path d="M315 650 C420 250 620 210 710 650 C640 540 550 500 480 650 Z" fill="none" stroke="#22d3ee" stroke-width="64" stroke-linecap="round"/>
    <text x="60" y="110" fill="#67e8f9" font-family="Arial" font-size="34" font-weight="700">AZ3D · MODELO 3D</text>
  </svg>
`)}`;

const whiteVariantImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f8fafc"/><circle cx="200" cy="200" r="120" fill="#e2e8f0"/></svg>')}`;
const whiteVariantDetailImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f1f5f9"/><circle cx="200" cy="200" r="80" fill="#cbd5e1"/></svg>')}`;
const redVariantImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#ef4444"/><circle cx="200" cy="200" r="120" fill="#b91c1c"/></svg>')}`;
const redVariantDetailImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#dc2626"/><circle cx="200" cy="200" r="80" fill="#991b1b"/></svg>')}`;

const tenant = { id: 1, name: 'AZ3D Studio', slug: 'az3d' };
const categories = [
  { id: 1, name: 'Organização', slug: 'organizacao', description: 'Itens para escritório e casa', icon: 'wrench' },
  { id: 2, name: 'Colecionáveis', slug: 'colecionaveis', description: 'Peças exclusivas e estatuetas', icon: 'shield' },
  { id: 3, name: 'Tech & Suportes', slug: 'tech-suportes', description: 'Suportes ergonômicos e acessórios', icon: 'cpu' },
];

const products = [
  {
    id: 1,
    tenant_id: 1,
    title: 'Suporte Escultural para Celular',
    slug: 'suporte-escultural-celular',
    sku: 'AZ3D-001',
    description: 'Uma peça funcional com curvas orgânicas, impressa sob demanda com preenchimento reforçado.',
    price: 79.9,
    image_url: productImage,
    color_images: [
      { color_name: 'Branco', image_url: whiteVariantImage, sort_order: 0 },
      { color_name: 'Branco', image_url: whiteVariantDetailImage, sort_order: 1 },
      { color_name: 'Vermelho', image_url: redVariantImage, sort_order: 2 },
    ],
    color_stocks: [
      { color_name: 'Branco', stock_qty: 7 },
      { color_name: 'Vermelho', stock_qty: 4 },
    ],
    category_id: 1,
    category: categories[0],
    material: 'PLA Premium',
    layer_height: '0.16 mm',
    print_time: '6 horas',
    dimensions: '120 × 120 × 150 mm',
    weight: '160 g',
    in_stock: true,
    stock_qty: 11,
    status: 'active',
    is_featured: true,
    review_summary: { average_rating: 4.9, review_count: 8 },
  },
  {
    id: 2,
    tenant_id: 1,
    title: 'Organizador Modular de Mesa',
    slug: 'organizador-modular-mesa',
    sku: 'AZ3D-002',
    description: 'Bandeja com divisórias magnéticas para ferramentas e canetas.',
    price: 54.5,
    image_url: productImage,
    color_images: [{ color_name: 'Preto', image_url: productImage, sort_order: 0 }],
    color_stocks: [{ color_name: 'Preto', stock_qty: 5 }],
    category_id: 1,
    category: categories[0],
    material: 'PETG',
    layer_height: '0.2 mm',
    print_time: '4 horas',
    dimensions: '180 × 90 × 70 mm',
    weight: '210 g',
    in_stock: true,
    stock_qty: 5,
    status: 'active',
  },
  {
    id: 3,
    tenant_id: 1,
    title: 'Luminária Geométrica Minimalista',
    slug: 'luminaria-geometrica',
    sku: 'AZ3D-003',
    description: 'Design escandinavo com difusor translúcido.',
    price: 119.0,
    image_url: whiteVariantImage,
    color_images: [{ color_name: 'Branco', image_url: whiteVariantImage, sort_order: 0 }],
    color_stocks: [{ color_name: 'Branco', stock_qty: 3 }],
    category_id: 2,
    category: categories[1],
    material: 'PLA Translúcido',
    layer_height: '0.12 mm',
    print_time: '12 horas',
    dimensions: '150 × 150 × 200 mm',
    weight: '280 g',
    in_stock: true,
    stock_qty: 3,
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
    } else if (url.pathname.includes('/reviews')) {
      body = [];
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
});

test('responsividade da home: sem overflow horizontal e elementos legíveis', async ({ page }, testInfo) => {
  await page.goto('/az3d/store');

  // Verifica elementos essenciais da loja
  await expect(page.getByRole('heading', { name: 'AZ3D Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explorar catálogo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver produto' })).toBeVisible();

  // Garante que não há overflow horizontal (scroll lateral indesejado)
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);

  // Categorias e grid
  await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible();
  await expect(page.getByText('3 produtos')).toBeVisible();

  // Captura de tela da Home
  await page.screenshot({
    path: `test-results/responsive/home-${testInfo.project.name}.png`,
    fullPage: false,
  });
});

test('responsividade do modal de produto: fotos adaptadas, cores e compra fluida', async ({ page }, testInfo) => {
  await page.goto('/az3d/store');

  // Abre o modal do primeiro produto
  await page.getByRole('button', { name: 'Ver produto' }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Suporte Escultural para Celular' })).toBeVisible();

  // Verifica que não há overflow horizontal
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);

  // Verifica botões de cores disponíveis
  await expect(modal.getByRole('button', { name: 'Selecionar cor Branco' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Selecionar cor Vermelho' })).toBeVisible();

  // Verifica foto 2 do produto
  await expect(modal.getByRole('button', { name: 'Ver foto 2 da cor Branco' })).toBeVisible();
  await modal.getByRole('button', { name: 'Ver foto 2 da cor Branco' }).click();

  // Verifica botão de compra visível
  const buyButton = modal.getByRole('button', { name: /entrar para comprar|adicionar ao carrinho|comprar/i });
  await expect(buyButton).toBeVisible();

  // Teste de aumento de quantidade e recálculo
  await modal.getByRole('button', { name: 'Aumentar quantidade' }).click();
  const totalBox = modal.getByLabel('Total da compra');
  await expect(totalBox.getByText('R$ 159,80', { exact: true })).toBeVisible();

  // Captura de tela do Modal
  await page.screenshot({
    path: `test-results/responsive/modal-${testInfo.project.name}.png`,
    fullPage: false,
  });

  // Fecha o modal
  await modal.getByRole('button', { name: 'Fechar detalhes do produto' }).click();
  await expect(modal).toHaveCount(0);
});

test('responsividade do carrinho: itens, frete e checkout sem corte', async ({ page }, testInfo) => {
  // Prepara carrinho inicial com 2 itens
  await page.addInitScript(() => {
    localStorage.setItem('az3d_tenant_id', '1');
    localStorage.setItem(
      'az3d_cart_tenant_1',
      JSON.stringify([
        {
          product: {
            id: 1,
            tenant_id: 1,
            title: 'Suporte Escultural para Celular',
            price: 79.9,
            image_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400',
            in_stock: true,
            stock_qty: 7,
          },
          quantity: 2,
          color: 'Branco',
        },
      ])
    );
  });

  await page.goto('/az3d/store');
  await page.getByRole('button', { name: 'Abrir carrinho de vendas' }).click();

  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Seu carrinho' })).toBeVisible();
  await expect(drawer.getByText('Suporte Escultural para Celular')).toBeVisible();

  // Verifica que não há overflow horizontal
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);

  // Captura de tela do Carrinho
  await page.screenshot({
    path: `test-results/responsive/cart-${testInfo.project.name}.png`,
    fullPage: false,
  });
});
