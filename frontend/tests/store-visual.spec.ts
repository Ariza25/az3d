import { expect, test } from '@playwright/test';

const productImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#16202b"/>
        <stop offset="1" stop-color="#071015"/>
      </linearGradient>
      <linearGradient id="print" x1="0" x2="1">
        <stop stop-color="#e2e8f0"/>
        <stop offset="0.5" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#94a3b8"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#bg)"/>
    <circle cx="930" cy="170" r="260" fill="#22d3ee" opacity=".12"/>
    <path d="M315 650 C420 250 620 210 710 650 C640 540 550 500 480 650 Z" fill="none" stroke="url(#print)" stroke-width="72" stroke-linecap="round"/>
    <text x="60" y="110" fill="#67e8f9" font-family="Arial" font-size="34" font-weight="700">AZ3D · PEÇA EM DESTAQUE</text>
  </svg>
`)}`;

const whiteVariantImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/></svg>')}`;
const redVariantImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#dc2626"/></svg>')}`;
const redVariantDetailImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="#dc2626"/></svg>')}`;

const tenant = { id: 1, name: 'AZ3D', slug: 'az3d' };
const categories = [
  { id: 1, name: 'Organização', slug: 'organizacao', description: '', icon: 'wrench' },
  { id: 2, name: 'Decoração', slug: 'decoracao', description: '', icon: 'sparkles' },
  { id: 3, name: 'Colecionáveis', slug: 'colecionaveis', description: '', icon: 'shield' },
];
const products = [
  {
    id: 1,
    tenant_id: 1,
    title: 'Suporte escultural para celular',
    slug: 'suporte-escultural-celular',
    sku: 'AZ3D-001',
    description: 'Uma peça funcional com acabamento limpo e curvas suaves, impressa sob demanda para organizar sua mesa.',
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
    review_summary: { average_rating: 4.8, review_count: 12 },
  },
  {
    id: 2,
    tenant_id: 1,
    title: 'Organizador modular de mesa',
    slug: 'organizador-modular',
    sku: 'AZ3D-002',
    description: 'Módulos compactos para manter acessórios e ferramentas sempre ao alcance.',
    price: 54.5,
    image_url: productImage,
    color_images: [{ color_name: 'Cinza', image_url: productImage, sort_order: 0 }],
    color_stocks: [{ color_name: 'Cinza', stock_qty: 2 }],
    category_id: 1,
    category: categories[0],
    material: 'PETG',
    layer_height: '0.2 mm',
    print_time: '5 horas',
    dimensions: '180 × 90 × 80 mm',
    weight: '220 g',
    in_stock: true,
    stock_qty: 2,
    status: 'active',
  },
  {
    id: 3,
    tenant_id: 1,
    title: 'Vasinho Leitor Branco',
    slug: 'vasinho-leitor-branco',
    sku: 'VL01-BRA',
    description: 'Vasinho leitor na cor branca.',
    price: 35.9,
    image_url: whiteVariantImage,
    color_images: [{ color_name: 'Padrao', image_url: whiteVariantImage, sort_order: 0 }],
    color_stocks: [{ color_name: 'Padrao', stock_qty: 10 }],
    category_id: 2,
    category: categories[1],
    material: 'PLA',
    layer_height: '0.16 mm',
    print_time: 'A confirmar',
    dimensions: 'A confirmar',
    weight: '0 g',
    in_stock: true,
    stock_qty: 10,
    status: 'draft',
    source_provider: 'mercadolivre',
    source_external_id: 'MLB-WHITE',
  },
  {
    id: 4,
    tenant_id: 1,
    title: 'Vasinho Leitor Vermelho',
    slug: 'vasinho-leitor-vermelho',
    sku: 'VL01-VER',
    description: 'Vasinho leitor na cor vermelha.',
    price: 35.9,
    image_url: redVariantImage,
    color_images: [
      { color_name: 'Padrao', image_url: redVariantImage, sort_order: 0 },
      { color_name: 'Padrao', image_url: redVariantDetailImage, sort_order: 1 },
    ],
    color_stocks: [{ color_name: 'Padrao', stock_qty: 8 }],
    category_id: 2,
    category: categories[1],
    material: 'PLA',
    layer_height: '0.16 mm',
    print_time: 'A confirmar',
    dimensions: 'A confirmar',
    weight: '0 g',
    in_stock: true,
    stock_qty: 8,
    status: 'draft',
    source_provider: 'mercadolivre',
    source_external_id: 'MLB-RED',
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
      body = { tenant_id: 1, store_name: 'AZ3D Studio', primary_color: '#22d3ee' };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
});

test('registra a home e o modal sem overflow horizontal', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AZ3D Studio' })).toBeVisible();
  await expect(page.getByText('3 produtos')).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);

  if (testInfo.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: /Filtros/ }).click();
    await expect(page.getByLabel('Material')).toBeVisible();
  }

  await page.screenshot({
    path: `test-results/playwright/store-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Ver produto' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Avaliar produto')).toHaveCount(0);
  await expect(modal.getByText('Prazo estimado')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Selecionar cor Branco' })).toHaveCount(0);
  const purchaseButton = modal.getByRole('button', { name: /comprar|carrinho/i });
  await expect(purchaseButton).toBeVisible();

  if (testInfo.project.name.startsWith('desktop')) {
    const priceBox = await modal.getByText('R$ 79,90', { exact: true }).boundingBox();
    const quantityBox = await modal.getByLabel('Quantidade', { exact: true }).boundingBox();
    const buttonBox = await purchaseButton.boundingBox();
    expect(priceBox && quantityBox && buttonBox).toBeTruthy();
    expect(Math.abs((priceBox!.y + priceBox!.height) - (buttonBox!.y + buttonBox!.height))).toBeLessThan(16);
    expect(Math.abs((quantityBox!.y + quantityBox!.height) - (buttonBox!.y + buttonBox!.height))).toBeLessThan(16);
  }

  await modal.getByRole('button', { name: 'Aumentar quantidade' }).click();
  const purchaseTotal = modal.getByLabel('Total da compra');
  await expect(purchaseTotal.getByText('R$ 159,80', { exact: true })).toBeVisible();
  await expect(purchaseTotal.getByText('2 × R$ 79,90 cada', { exact: true })).toBeVisible();

  await page.screenshot({
    path: `test-results/playwright/modal-${testInfo.project.name}.png`,
    fullPage: false,
  });
});

test('agrupa anuncios de cores e troca produto e galeria no modal', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Vasinho Leitor', exact: true })).toHaveCount(1);
  await page.getByRole('heading', { name: 'Vasinho Leitor', exact: true }).click();

  const modal = page.getByRole('dialog');
  const mainImage = modal.getByAltText('Vasinho Leitor', { exact: true });
  await expect(modal.getByRole('button', { name: 'Selecionar cor Branco' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Selecionar cor Vermelho' })).toBeVisible();
  await expect(mainImage).toHaveAttribute('src', whiteVariantImage);
  await expect(modal.getByText('SKU VL01-BRA')).toBeVisible();

  await modal.getByRole('button', { name: 'Selecionar cor Vermelho' }).click();
  await expect(mainImage).toHaveAttribute('src', redVariantImage);
  await expect(modal.getByText('SKU VL01-VER')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Ver foto 2 da cor Vermelho' })).toBeVisible();
  await modal.getByRole('button', { name: 'Ver foto 2 da cor Vermelho' }).click();
  await expect(mainImage).toHaveAttribute('src', redVariantDetailImage);
});
