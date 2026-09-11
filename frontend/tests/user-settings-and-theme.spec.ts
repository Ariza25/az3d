import { expect, test } from '@playwright/test';

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
    description: 'Peça funcional com acabamento limpo.',
    price: 79.9,
    image_url: 'https://via.placeholder.com/400',
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
];

let currentUser = {
  id: 12,
  tenant_id: 1,
  name: 'Matheus Santos',
  email: 'matheus@example.com',
  phone: '(11) 98888-7777',
  role: 'customer',
  created_at: '2026-01-10T10:00:00Z',
  addresses: JSON.stringify([
    {
      id: 'addr_1',
      label: 'Casa',
      recipient: 'Matheus Santos',
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 42',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      is_default: true,
    },
  ]),
  saved_cards: JSON.stringify([
    {
      id: 'card_1',
      holder_name: 'MATHEUS SANTOS',
      last_four: '4242',
      brand: 'visa',
      expiry_month: '12',
      expiry_year: '28',
      is_default: true,
    },
  ]),
};

test.beforeEach(async ({ page }) => {
  currentUser = {
    id: 12,
    tenant_id: 1,
    name: 'Matheus Santos',
    email: 'matheus@example.com',
    phone: '(11) 98888-7777',
    role: 'customer',
    created_at: '2026-01-10T10:00:00Z',
    addresses: JSON.stringify([
      {
        id: 'addr_1',
        label: 'Casa',
        recipient: 'Matheus Santos',
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Apto 42',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        is_default: true,
      },
    ]),
    saved_cards: JSON.stringify([
      {
        id: 'card_1',
        holder_name: 'MATHEUS SANTOS',
        last_four: '4242',
        brand: 'visa',
        expiry_month: '12',
        expiry_year: '28',
        is_default: true,
      },
    ]),
  };

  await page.route('http://localhost:8080/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === '/api/tenants') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([tenant]) });
    } else if (url.pathname.startsWith('/api/tenants/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tenant) });
    } else if (url.pathname === '/api/categories') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(categories) });
    } else if (url.pathname === '/api/products') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) });
    } else if (url.pathname === '/api/tenant/settings') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenant_id: 1,
          store_name: 'AZ3D Studio',
          primary_color: '#22d3ee',
          delivery_ship_enabled: true,
          delivery_pickup_enabled: true,
        }),
      });
    } else if (url.pathname === '/api/auth/me') {
      if (method === 'PUT') {
        const payload = JSON.parse(route.request().postData() || '{}');
        currentUser = { ...currentUser, ...payload };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
      }
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });
});

test('alterna entre tema claro (branco gelo) e escuro', async ({ page }) => {
  await page.goto('/#az3d-test');
  await page.evaluate(() => {
    localStorage.setItem('az3d_customer_token', 'test-token');
    localStorage.removeItem('az3d_theme');
  });
  await page.reload();

  // Verifica que começa no modo escuro por padrão
  await expect(page.locator('html')).toHaveClass(/dark/);

  // Clica no botão de alternância de tema no Navbar
  const themeToggle = page.locator('button[title*="Tema Claro"]');
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();

  // Verifica se o tema claro foi aplicado ao HTML e body
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.locator('body')).toHaveClass(/theme-light/);

  // Alterna de volta para o tema escuro
  const darkToggle = page.locator('button[title*="Tema Escuro"]');
  await expect(darkToggle).toBeVisible();
  await darkToggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('abre aba de configurações e gerencia perfil, email e telefone', async ({ page }) => {
  await page.goto('/#az3d-test');
  await page.evaluate(() => {
    localStorage.setItem('az3d_customer_token', 'test-token');
  });
  await page.reload();

  // Clica no botão de configurações no Navbar
  const settingsBtn = page.getByRole('button', { name: /abrir configurações da conta/i });
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();

  // Modal de configurações visível
  await expect(page.getByText('Minha Conta & Configurações')).toBeVisible();

  // Aba Perfil & Contato está ativa por padrão
  const emailInput = page.getByPlaceholder('exemplo@email.com');
  await expect(emailInput).toHaveValue('matheus@example.com');

  // Edita telefone e salva
  const phoneInput = page.getByPlaceholder('(11) 99999-9999');
  await phoneInput.fill('11977776666');
  await page.getByRole('button', { name: /salvar alterações do perfil/i }).click();

  await expect(page.getByText('Dados da sua conta atualizados com sucesso!')).toBeVisible();
});

test('adiciona, edita e exclui endereços de entrega na aba de configurações', async ({ page }) => {
  await page.goto('/#az3d-test');
  await page.evaluate(() => {
    localStorage.setItem('az3d_customer_token', 'test-token');
  });
  await page.reload();

  // Abre modal
  await page.getByRole('button', { name: /abrir configurações da conta/i }).click();

  // Troca para a aba de Endereços
  await page.getByRole('button', { name: /Endereços/i }).click();

  // Verifica endereço existente
  await expect(page.getByText('Avenida Paulista, 1000')).toBeVisible();
  await expect(page.getByText('Padrão')).toBeVisible();

  // Adiciona novo endereço
  await page.getByRole('button', { name: /Novo Endereço/i }).click();
  await page.getByPlaceholder('Ex: Casa, Trabalho, Galpão').fill('Trabalho');
  await page.getByPlaceholder('Nome de quem vai receber').fill('Matheus Escritório');
  await page.getByPlaceholder('00000-000').fill('04543000');
  await page.getByPlaceholder('Avenida, Rua, Alameda...').fill('Avenida Faria Lima');
  await page.getByPlaceholder('123').fill('3000');
  await page.getByPlaceholder('Bairro').fill('Itaim Bibi');
  await page.getByPlaceholder('Cidade').fill('São Paulo');
  await page.getByPlaceholder('SP').fill('SP');

  await page.getByRole('button', { name: /Salvar Endereço/i }).click();

  // Verifica se o novo endereço aparece na lista
  await expect(page.getByText('Avenida Faria Lima, 3000')).toBeVisible();
});

test('adiciona, edita e exclui cartões de pagamento na aba de configurações', async ({ page }) => {
  await page.goto('/#az3d-test');
  await page.evaluate(() => {
    localStorage.setItem('az3d_customer_token', 'test-token');
  });
  await page.reload();

  // Abre modal
  await page.getByRole('button', { name: /abrir configurações da conta/i }).click();

  // Troca para a aba de Cartões
  await page.getByRole('button', { name: /Cartões de Pagamento/i }).click();

  // Verifica cartão existente
  await expect(page.getByText('•••• •••• •••• 4242')).toBeVisible();
  await expect(page.getByText('Preferencial')).toBeVisible();

  // Adiciona novo cartão
  await page.getByRole('button', { name: /Adicionar Cartão/i }).click();
  await page.getByPlaceholder('0000 0000 0000 0000').fill('5555444433332222');
  await page.getByPlaceholder('COMO NO CARTÃO').fill('MATHEUS SANTOS ADV');
  await page.getByPlaceholder('MM (ex: 08)').fill('10');
  await page.getByPlaceholder('AA (ex: 29)').fill('30');

  await page.getByRole('button', { name: /Salvar Cartão/i }).click();

  // Verifica se o novo cartão aparece
  await expect(page.getByText('•••• •••• •••• 2222')).toBeVisible();
});
