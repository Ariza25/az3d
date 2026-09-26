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

const tenant = { id: 1, name: 'AZ3D Studio', slug: 'az3d' };
const categories = [
  { id: 1, name: 'Organização', slug: 'organizacao', description: 'Itens para escritório e casa', icon: 'wrench' },
  { id: 2, name: 'Colecionáveis', slug: 'colecionaveis', description: 'Peças exclusivas e estatuetas', icon: 'shield' },
  { id: 3, name: 'Decoração', slug: 'decoracao', description: 'Vasos e luminárias modernas', icon: 'sparkles' },
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
    category_id: 1,
    category: categories[0],
    material: 'PLA Premium',
    dimensions: '120 × 120 × 150 mm',
    in_stock: true,
    stock_qty: 11,
    status: 'active',
    is_featured: true,
    sales_count: 42,
    review_summary: { average_rating: 4.9, review_count: 8 },
  },
  {
    id: 2,
    tenant_id: 1,
    title: 'Organizador Modular de Mesa',
    slug: 'organizador-modular-mesa',
    sku: 'AZ3D-002',
    description: 'Bandeja com divisórias para ferramentas, cabos e canetas de precisão.',
    price: 54.5,
    image_url: productImage,
    color_images: [{ color_name: 'Preto', image_url: productImage, sort_order: 0 }],
    category_id: 1,
    category: categories[0],
    material: 'PETG Reforçado',
    dimensions: '180 × 90 × 70 mm',
    in_stock: true,
    stock_qty: 5,
    status: 'active',
    is_featured: true,
    sales_count: 28,
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
    category_id: 3,
    category: categories[2],
    material: 'PLA Translúcido',
    dimensions: '150 × 150 × 200 mm',
    in_stock: true,
    stock_qty: 3,
    status: 'active',
    is_featured: true,
    sales_count: 15,
  },
  {
    id: 4,
    tenant_id: 1,
    title: 'Vaso Poligonal Origami',
    slug: 'vaso-poligonal-origami',
    sku: 'AZ3D-004',
    description: 'Vaso decorativo multifacetado inspirado na arte tradicional do origami.',
    price: 49.9,
    image_url: productImage,
    category_id: 3,
    category: categories[2],
    material: 'PLA Silk Prata',
    dimensions: '110 × 110 × 190 mm',
    in_stock: true,
    stock_qty: 8,
    status: 'active',
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8080/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};

    if (url.pathname === '/api/tenants') {
      body = [tenant];
    } else if (url.pathname.startsWith('/api/tenants/')) {
      body = tenant;
    } else if (url.pathname === '/api/categories') {
      body = categories;
    } else if (url.pathname === '/api/products') {
      const isPaginated = url.searchParams.get('paginated') === 'true';
      if (isPaginated) {
        body = {
          items: products,
          total: products.length,
          page: 1,
          limit: 24,
          total_pages: 1,
          has_more: false,
        };
      } else {
        body = products;
      }
    } else if (url.pathname === '/api/tenant/settings') {
      body = {
        tenant_id: 1,
        store_name: 'AZ3D Studio',
        primary_color: '#22d3ee',
        logo_url: null,
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
});

test('catálogo mobile tem estritamente 1 coluna, sem overflow horizontal, e preserva tablet/desktop', async ({ page }, testInfo) => {
  await page.goto('/az3d/catalog');

  // Verifica elementos do cabeçalho
  await expect(page.getByRole('heading', { name: 'AZ3D Studio' })).toBeVisible({ timeout: 15000 });

  // Garante que não há overflow horizontal na página
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);

  // Seleciona os cards da grade de produtos
  const cards = page.locator('article');
  await expect(cards).toHaveCount(4);

  // Se for celular (resolução móvel), verifica que é estritamente 1 coluna!
  const isMobile = testInfo.project.name.startsWith('mobile');
  const isTablet = testInfo.project.name === 'tablet-ipad';
  const isDesktop = testInfo.project.name.startsWith('desktop');

  if (isMobile) {
    const box1 = await cards.nth(0).boundingBox();
    const box2 = await cards.nth(1).boundingBox();
    expect(box1).toBeTruthy();
    expect(box2).toBeTruthy();

    // Em 1 coluna, a coordenada horizontal (x) dos dois primeiros cards deve ser praticamente idêntica (alinhados na vertical)
    expect(Math.abs(box1!.x - box2!.x)).toBeLessThan(8);

    // E o segundo card deve estar verticalmente abaixo do primeiro
    expect(box2!.y).toBeGreaterThan(box1!.y + box1!.height - 10);

    // A largura do card deve ocupar praticamente todo o container útil da tela (sem ficar comprimido a 150px)
    const viewportWidth = page.viewportSize()?.width || 375;
    expect(box1!.width).toBeGreaterThan(viewportWidth - 50);
  } else if (isTablet) {
    // No tablet iPad (768px), o layout tem múltiplas colunas (md:grid-cols-3)
    const box1 = await cards.nth(0).boundingBox();
    const box2 = await cards.nth(1).boundingBox();
    expect(box1).toBeTruthy();
    expect(box2).toBeTruthy();
    // No tablet, card 1 e card 2 ficam lado a lado horizontalmente
    expect(box2!.x).toBeGreaterThan(box1!.x + 100);
  } else if (isDesktop) {
    // No desktop (1440px), o layout tem 4 colunas (lg:grid-cols-4)
    const box1 = await cards.nth(0).boundingBox();
    const box2 = await cards.nth(1).boundingBox();
    const box3 = await cards.nth(2).boundingBox();
    const box4 = await cards.nth(3).boundingBox();
    expect(box1 && box2 && box3 && box4).toBeTruthy();
    expect(box2!.x).toBeGreaterThan(box1!.x);
    expect(box3!.x).toBeGreaterThan(box2!.x);
    expect(box4!.x).toBeGreaterThan(box3!.x);
  }

  // Captura de tela do catálogo antes de abrir modal (página inteira)
  await page.screenshot({
    path: `test-results/responsive-catalog/catalog-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('modal de detalhes adapta fotos e informações perfeitamente no mobile, tablet e desktop', async ({ page }, testInfo) => {
  await page.goto('/az3d/catalog');

  // Aguarda carregamento inicial sumir
  const firstCard = page.locator('article').first();
  await expect(firstCard).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('status', { name: 'Carregando' })).toBeHidden({ timeout: 15000 });

  // Abre o modal de detalhes do primeiro item
  await firstCard.getByRole('button', { name: 'Ver detalhes', exact: true }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  // Verifica informações chave no modal
  await expect(modal.getByRole('heading', { name: 'Suporte Escultural para Celular' })).toBeVisible();
  await expect(modal.getByText('R$ 79,90')).toBeVisible();
  await expect(modal.getByText('12 x 12 x 15 cm')).toBeVisible();

  // Garante que não há overflow horizontal com o modal aberto
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);

  // Verifica botões de ação do modal
  const whatsappBtn = modal.getByRole('button', { name: 'Tirar dúvidas no WhatsApp' });
  const storeBtn = modal.getByRole('button', { name: 'Ver na Loja Oficial' });
  await expect(whatsappBtn).toBeVisible();
  await expect(storeBtn).toBeVisible();

  const isMobile = testInfo.project.name.startsWith('mobile');
  if (isMobile) {
    // No mobile, os botões ficam empilhados para toque confortável com o polegar
    const wBox = await whatsappBtn.boundingBox();
    const sBox = await storeBtn.boundingBox();
    expect(wBox && sBox).toBeTruthy();
    expect(sBox!.y).toBeGreaterThan(wBox!.y);
  }

  // Captura de tela do modal aberto
  await page.screenshot({
    path: `test-results/responsive-catalog/modal-${testInfo.project.name}.png`,
    fullPage: false,
  });

  // Fecha o modal pelo botão X
  await modal.getByRole('button', { name: 'Fechar detalhes' }).click();
  await expect(modal).toHaveCount(0);
});

test('alterna para modo compacto sem quebrar ou gerar scroll horizontal', async ({ page }, testInfo) => {
  await page.goto('/az3d/catalog');

  // Aguarda carregamento inicial sumir
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('status', { name: 'Carregando' })).toBeHidden({ timeout: 15000 });

  // Alterna para modo compacto (lista)
  await page.getByRole('button', { name: 'Visualização em lista' }).click();

  // Verifica itens na lista compacta
  await expect(page.locator('.space-y-2').getByText('Suporte Escultural para Celular')).toBeVisible();
  await expect(page.locator('.space-y-2').getByText('Organizador Modular de Mesa')).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);

  // Captura de tela da lista compacta
  await page.screenshot({
    path: `test-results/responsive-catalog/compact-${testInfo.project.name}.png`,
    fullPage: false,
  });
});
