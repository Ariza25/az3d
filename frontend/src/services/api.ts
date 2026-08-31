import {
  Category,
  Product,
  AuthResponse,
  User,
  CreateOrderPayload,
  CreateOrderResponse,
  Order,
  Tenant,
  ProductInput,
  MarketplaceIntegration,
  MarketplaceProductMapping,
  ProductReview,
  ProductFavorite,
  TenantSettings,
  TenantPricingBundle,
  PrintingPricingInput,
  PricingCalculationResponse,
  ProductPricingSnapshot,
  TenantFixedCost,
  ProductActualCost,
  ProductActualCostInput,
  FinancialSummary,
  PresetInput,
  MaterialPreset,
  PrinterPreset,
  PlatformFeePreset,
  PricingScenarioResponse,
  MarketplaceAccount,
  MarketplaceAccountInput,
  MarketplaceOAuthStartResponse,
  MarketplaceProductMappingInput,
  ExternalMarketplaceOrder,
  MarketplaceProductImportInput,
  MarketplaceProductImportResponse,
  TenantMarketplaceSettings,
  TenantMarketplaceSettingsInput,
  StockMovement,
  StockAdjustmentInput,
  TenantCarrierAccount,
  TenantCarrierAccountInput,
  OrderShipment,
  OrderShipmentInput,
  CarrierHealthItem,
  TrackingSyncEntry,
  TrackingSyncSummary,
  StockAlert,
  PlatformOverview,
  WebhookLogItem,
  ObservabilityHealth,
  PlatformEnvironment,
  MercadoPagoPlatformConfig,
  MercadoLivrePlatformConfig,
  MasterOAuthStartResponse,
  TenantPaymentAccountStatus,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
export const resolveApiAssetUrl = (path: string) => {
  if (!path || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
  return new URL(path.startsWith('/') ? path : `/${path}`, apiOrigin).toString();
};
export const CUSTOMER_TOKEN_KEY = 'az3d_customer_token';
export const ADMIN_TOKEN_KEY = 'az3d_admin_token';

const getHeaders = (tenantId?: number, tokenKey: string = CUSTOMER_TOKEN_KEY) => {
  const token = localStorage.getItem(tokenKey);
  const storedTenant = tenantId || localStorage.getItem('az3d_tenant_id') || '1';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': String(storedTenant),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const getAdminHeaders = (tenantId?: number) => getHeaders(tenantId, ADMIN_TOKEN_KEY);

const readJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      const statusSuffix = response.status ? ` (HTTP ${response.status})` : '';
      if (!response.ok) throw new Error(`${fallbackMessage}${statusSuffix}`);
      throw new Error(`${fallbackMessage}: resposta inválida do servidor${statusSuffix}`);
    }
  }

  if (!response.ok) {
    const apiMessage = body && typeof body === 'object' && 'error' in body
      ? String((body as { error?: unknown }).error || '')
      : '';
    const statusSuffix = response.status ? ` (HTTP ${response.status})` : '';
    throw new Error(apiMessage || `${fallbackMessage}${statusSuffix}`);
  }

  if (body === null) throw new Error(`${fallbackMessage}: resposta vazia do servidor`);
  return body as T;
};

const getUploadHeaders = (tenantId?: number) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const storedTenant = tenantId || localStorage.getItem('az3d_tenant_id') || '1';
  const headers: Record<string, string> = {
    'X-Tenant-ID': String(storedTenant),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Tenants
  getTenants: async (): Promise<Tenant[]> => {
    const res = await fetch(`${API_BASE_URL}/tenants`);
    if (!res.ok) throw new Error('Falha ao carregar lista de lojas (tenants)');
    return res.json();
  },

  getTenantByIdentifier: async (identifier: string): Promise<Tenant> => {
    const res = await fetch(`${API_BASE_URL}/tenants/${encodeURIComponent(identifier)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Loja nao encontrada');
    return data;
  },

  getMercadoPagoPlatformConfig: async (): Promise<MercadoPagoPlatformConfig> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/payments/mercadopago`, { headers: getAdminHeaders() });
    return readJsonResponse(res, 'Erro ao carregar aplicação Mercado Pago');
  },

  getMercadoLivrePlatformConfig: async (): Promise<MercadoLivrePlatformConfig> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/marketplaces/mercadolivre`, { headers: getAdminHeaders() });
    return readJsonResponse(res, 'Erro ao carregar aplicação Mercado Livre');
  },

  startMasterMercadoLivreOAuth: async (tenantId: number): Promise<MasterOAuthStartResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/tenants/${tenantId}/marketplaces/mercadolivre/oauth/start`, {
      method: 'POST', headers: getAdminHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao iniciar autorizacao Mercado Livre');
    return body;
  },

  startMasterMercadoPagoOAuth: async (tenantId: number): Promise<MasterOAuthStartResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/tenants/${tenantId}/payments/mercadopago/oauth/start`, {
      method: 'POST', headers: getAdminHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao iniciar autorizacao Mercado Pago');
    return body;
  },

  getTenantMercadoPagoStatus: async (tenantId?: number): Promise<TenantPaymentAccountStatus> => {
    const res = await fetch(`${API_BASE_URL}/admin/payments/mercadopago/status`, { headers: getAdminHeaders(tenantId) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao carregar conexao Mercado Pago');
    return body;
  },

  startTenantMercadoPagoOAuth: async (tenantId?: number): Promise<{ authorization_url: string }> => {
    const res = await fetch(`${API_BASE_URL}/admin/payments/mercadopago/oauth/start`, {
      method: 'POST', headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao iniciar conexao Mercado Pago');
    return body;
  },

  refreshTenantMercadoPagoOAuth: async (tenantId?: number): Promise<TenantPaymentAccountStatus> => {
    const res = await fetch(`${API_BASE_URL}/admin/payments/mercadopago/oauth/refresh`, {
      method: 'POST', headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao renovar conexao Mercado Pago');
    return body;
  },

  disconnectTenantMercadoPagoOAuth: async (tenantId?: number): Promise<TenantPaymentAccountStatus> => {
    const res = await fetch(`${API_BASE_URL}/admin/payments/mercadopago/oauth`, {
      method: 'DELETE', headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao desconectar Mercado Pago');
    return body;
  },

  // Categorias
  getCategories: async (tenantId?: number): Promise<Category[]> => {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Falha ao carregar categorias');
    return res.json();
  },

  // Produtos
  getProducts: async (category?: string, query?: string, tenantId?: number): Promise<Product[]> => {
    const params = new URLSearchParams();
    if (category && category !== 'todas') params.append('category', category);
    if (query) params.append('q', query);

    const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Falha ao carregar produtos');
    return res.json();
  },

  getProductById: async (id: number, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Produto não encontrado');
    return res.json();
  },

  getTenantSettings: async (tenantId?: number): Promise<TenantSettings> => {
    const res = await fetch(`${API_BASE_URL}/tenant/settings`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Falha ao carregar configuracoes da loja');
    return res.json();
  },

  getProductReviews: async (productId: number, tenantId?: number): Promise<ProductReview[]> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Falha ao carregar avaliacoes');
    return res.json();
  },

  saveProductReview: async (productId: number, rating: number, comment = '', tenantId?: number): Promise<ProductReview> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify({ rating, comment }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar avaliacao');
    return data;
  },

  addProductFavorite: async (productId: number, tenantId?: number): Promise<ProductFavorite> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/favorite`, {
      method: 'POST',
      headers: getHeaders(tenantId),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao favoritar produto');
    return data;
  },

  removeProductFavorite: async (productId: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/favorite`, {
      method: 'DELETE',
      headers: getHeaders(tenantId),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao remover favorito');
    }
  },

  getMyFavorites: async (tenantId?: number): Promise<ProductFavorite[]> => {
    const res = await fetch(`${API_BASE_URL}/favorites`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar favoritos');
    return res.json();
  },

  // Autenticação (JWT)
  customerLogin: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/customer/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao realizar login');
    return data;
  },

  customerRegister: async (name: string, email: string, password: string, tenantId?: number): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/customer/register`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify({ name, email, password, tenant_id: tenantId || 1 }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar usuário');
    return data;
  },

  sellerRegister: async (name: string, email: string, password: string, storeName: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/seller/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password, store_name: storeName, account_type: 'seller' }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar vendedor');
    return data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => api.customerLogin(email, password),

  register: async (name: string, email: string, password: string, tenantId?: number): Promise<AuthResponse> =>
    api.customerRegister(name, email, password, tenantId),

  adminLogin: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao realizar login administrativo');
    return data;
  },

  getMe: async (tokenKey: string = CUSTOMER_TOKEN_KEY): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(undefined, tokenKey),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sessão expirada');
    return data;
  },

  startGoogleOAuth: async (
    scope: 'customer' | 'admin' | 'seller',
    options: { tenantId?: number; returnTo?: string; storeName?: string } = {}
  ): Promise<{ auth_url: string }> => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    params.set('return_to', options.returnTo || window.location.pathname + window.location.search);
    if (options.tenantId) params.set('tenant_id', String(options.tenantId));
    if (options.storeName) params.set('store_name', options.storeName);

    const res = await fetch(`${API_BASE_URL}/auth/google/start?${params.toString()}`, {
      headers: getHeaders(options.tenantId, scope === 'admin' || scope === 'seller' ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao iniciar login Google');
    return data;
  },

  // Pedidos Cliente
  createOrder: async (payload: CreateOrderPayload, tenantId?: number): Promise<CreateOrderResponse> => {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao finalizar pedido');
    return data;
  },

  getMyOrders: async (tenantId?: number): Promise<Order[]> => {
    const res = await fetch(`${API_BASE_URL}/orders/my-orders`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar histórico de pedidos');
    return res.json();
  },

  // --- ROTAS ADMINISTRATIVAS ---

  createProduct: async (productData: ProductInput, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/admin/products`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(productData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar novo produto');
    return data;
  },

  getAdminProducts: async (tenantId?: number, query?: string): Promise<Product[]> => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    const res = await fetch(`${API_BASE_URL}/admin/products?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao buscar produtos do admin');
    return res.json();
  },

  updateProduct: async (id: number, productData: ProductInput, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(productData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar produto');
    return data;
  },

  deleteProduct: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(tenantId),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir produto');
    }
  },

  createCategory: async (categoryData: { name: string; description?: string; icon?: string }, tenantId?: number): Promise<Category> => {
    const res = await fetch(`${API_BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(categoryData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar categoria');
    return data;
  },

  getAdminOrders: async (tenantId?: number): Promise<Order[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/orders`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao buscar pedidos do admin');
    return res.json();
  },

  updateOrderStatus: async (orderId: number, status: string, tenantId?: number): Promise<Order> => {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ status }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar status do pedido');
    return data;
  },

  getStockMovements: async (tenantId?: number, productId?: number): Promise<StockMovement[]> => {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', String(productId));
    const res = await fetch(`${API_BASE_URL}/admin/stock-movements?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar historico de estoque');
    return res.json();
  },

  getStockAlerts: async (tenantId?: number, threshold = 3): Promise<StockAlert[]> => {
    const params = new URLSearchParams();
    params.append('threshold', String(threshold));
    const res = await fetch(`${API_BASE_URL}/admin/stock-alerts?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar alertas de estoque');
    return res.json();
  },

  adjustStock: async (input: StockAdjustmentInput, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/admin/stock-adjustments`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao ajustar estoque');
    return data;
  },

  getCarrierAccounts: async (tenantId?: number): Promise<TenantCarrierAccount[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/carrier-accounts`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar contas de transportadora');
    return res.json();
  },

  saveCarrierAccount: async (data: TenantCarrierAccountInput, tenantId?: number): Promise<TenantCarrierAccount> => {
    const res = await fetch(`${API_BASE_URL}/admin/carrier-accounts`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar transportadora');
    return body;
  },

  toggleCarrierAccount: async (id: number, tenantId?: number): Promise<TenantCarrierAccount> => {
    const res = await fetch(`${API_BASE_URL}/admin/carrier-accounts/${id}/toggle`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao alternar transportadora');
    return body;
  },

  getCarrierHealth: async (tenantId?: number): Promise<CarrierHealthItem[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/carrier-health`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar saude das transportadoras');
    return res.json();
  },

  getShipments: async (tenantId?: number, orderId?: number): Promise<OrderShipment[]> => {
    const params = new URLSearchParams();
    if (orderId) params.append('order_id', String(orderId));
    const res = await fetch(`${API_BASE_URL}/admin/shipments?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar envios');
    return res.json();
  },

  saveShipment: async (data: OrderShipmentInput, tenantId?: number): Promise<OrderShipment> => {
    const res = await fetch(`${API_BASE_URL}/admin/shipments`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar envio');
    return body;
  },

  syncShipment: async (id: number, tenantId?: number): Promise<TrackingSyncEntry> => {
    const res = await fetch(`${API_BASE_URL}/admin/shipments/${id}/sync`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao sincronizar envio');
    return body;
  },

  syncTracking: async (tenantId?: number): Promise<TrackingSyncSummary> => {
    const res = await fetch(`${API_BASE_URL}/admin/shipments/sync`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao sincronizar rastreios');
    return body;
  },

  getPlatformOverview: async (): Promise<PlatformOverview> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/overview`, {
      headers: getAdminHeaders(),
    });
    return readJsonResponse<PlatformOverview>(res, 'Erro ao carregar visao de plataforma');
  },

  getObservabilityHealth: async (): Promise<ObservabilityHealth> => {
    let res = await fetch(`${API_BASE_URL}/admin/platform/observability`, {
      headers: getAdminHeaders(),
    });
    if (res.status === 404) {
      res = await fetch(`${API_BASE_URL}/admin/observability/health`, {
        headers: getAdminHeaders(),
      });
    }
    return readJsonResponse<ObservabilityHealth>(res, 'Erro ao carregar saude operacional');
  },

  getWebhookLogs: async (limit = 100): Promise<WebhookLogItem[]> => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    let res = await fetch(`${API_BASE_URL}/admin/platform/outbox?${params.toString()}`, {
      headers: getAdminHeaders(),
    });
    if (res.status === 404) {
      res = await fetch(`${API_BASE_URL}/admin/observability/webhooks?${params.toString()}`, {
        headers: getAdminHeaders(),
      });
    }
    return readJsonResponse<WebhookLogItem[]>(res, 'Erro ao carregar webhooks');
  },

  getPlatformEnvironment: async (): Promise<PlatformEnvironment> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/environment`, {
      headers: getAdminHeaders(),
    });
    return readJsonResponse<PlatformEnvironment>(res, 'Erro ao carregar ambiente da plataforma');
  },

  getAdminTenantSettings: async (tenantId?: number): Promise<TenantSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/tenant/settings`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar configuracoes da loja');
    return res.json();
  },

  updateAdminTenantSettings: async (settings: TenantSettings, tenantId?: number): Promise<TenantSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/tenant/settings`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(settings),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar configuracoes da loja');
    return data;
  },

  getAdminPricingSettings: async (tenantId?: number): Promise<TenantPricingBundle> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/settings`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar configuracoes de precificacao');
    return res.json();
  },

  calculatePricing: async (input: PrintingPricingInput, tenantId?: number): Promise<PricingCalculationResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/calculate`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(input),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao calcular precificacao');
    return data;
  },

  applyProductPricing: async (productId: number, input: PrintingPricingInput, tenantId?: number): Promise<PricingCalculationResponse & { product: Product }> => {
    const res = await fetch(`${API_BASE_URL}/admin/products/${productId}/pricing/apply`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(input),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao aplicar precificacao ao produto');
    return data;
  },

  getProductPricingSnapshots: async (productId: number, tenantId?: number): Promise<ProductPricingSnapshot[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/products/${productId}/pricing/snapshots`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar historico de precificacao');
    return res.json();
  },

  getFinancialSummary: async (tenantId?: number): Promise<FinancialSummary> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/financial-summary`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar financeiro');
    return res.json();
  },

  getFixedCosts: async (tenantId?: number): Promise<TenantFixedCost[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/fixed-costs`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar custos fixos');
    return res.json();
  },

  saveFixedCost: async (data: Omit<TenantFixedCost, 'id' | 'tenant_id'>, tenantId?: number): Promise<TenantFixedCost> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/fixed-costs`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar custo fixo');
    return body;
  },

  deleteFixedCost: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/fixed-costs/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao remover custo fixo');
  },

  getActualCosts: async (tenantId?: number, productId?: number): Promise<ProductActualCost[]> => {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', String(productId));
    const res = await fetch(`${API_BASE_URL}/admin/pricing/actual-costs?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar custos reais');
    return res.json();
  },

  saveActualCost: async (data: ProductActualCostInput, tenantId?: number): Promise<ProductActualCost> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/actual-costs`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar custo real');
    return body;
  },

  calculatePricingScenario: async (
    data: { product_id?: number; quantity: number; base: PrintingPricingInput; platform_fee_scenarios: PlatformFeePreset[] },
    tenantId?: number
  ): Promise<PricingScenarioResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/scenario`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao calcular cenarios');
    return body;
  },

  saveMaterialPreset: async (data: PresetInput, tenantId?: number): Promise<MaterialPreset> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/material-presets`, { method: 'POST', headers: getAdminHeaders(tenantId), body: JSON.stringify(data) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar material');
    return body;
  },

  deleteMaterialPreset: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/material-presets/${id}`, { method: 'DELETE', headers: getAdminHeaders(tenantId) });
    if (!res.ok) throw new Error('Erro ao remover material');
  },

  savePrinterPreset: async (data: PresetInput, tenantId?: number): Promise<PrinterPreset> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/printer-presets`, { method: 'POST', headers: getAdminHeaders(tenantId), body: JSON.stringify(data) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar impressora');
    return body;
  },

  deletePrinterPreset: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/printer-presets/${id}`, { method: 'DELETE', headers: getAdminHeaders(tenantId) });
    if (!res.ok) throw new Error('Erro ao remover impressora');
  },

  savePlatformPreset: async (data: PresetInput, tenantId?: number): Promise<PlatformFeePreset> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/platform-presets`, { method: 'POST', headers: getAdminHeaders(tenantId), body: JSON.stringify(data) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar canal');
    return body;
  },

  deletePlatformPreset: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/pricing/platform-presets/${id}`, { method: 'DELETE', headers: getAdminHeaders(tenantId) });
    if (!res.ok) throw new Error('Erro ao remover canal');
  },

  uploadProductImage: async (file: File, tenantId?: number): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/admin/uploads/products`, {
      method: 'POST',
      headers: getUploadHeaders(tenantId),
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar imagem');
    return data;
  },

  // --- MARKETPLACES (Mercado Livre, Shopee, Amazon) ---

  getMarketplaces: async (tenantId?: number): Promise<MarketplaceIntegration[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao buscar integrações de marketplaces');
    return res.json();
  },

  saveMarketplace: async (
    data: { provider: string; seller_id: string; seller_name?: string; is_active: boolean; sync_orders: boolean; sync_stock: boolean },
    tenantId?: number
  ): Promise<MarketplaceIntegration> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao salvar integração de marketplace');
    return resData;
  },

  toggleMarketplace: async (id: number, tenantId?: number): Promise<MarketplaceIntegration> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/${id}/toggle`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao alternar status do marketplace');
    return resData;
  },

  getProductMappings: async (tenantId?: number): Promise<MarketplaceProductMapping[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/mappings`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar mapeamentos de anúncios');
    return res.json();
  },

  getMarketplaceAccounts: async (tenantId?: number): Promise<MarketplaceAccount[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/accounts`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar contas de marketplace');
    return res.json();
  },

  getMarketplaceSettings: async (tenantId?: number): Promise<TenantMarketplaceSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/settings`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar regras de marketplace');
    return res.json();
  },

  updateMarketplaceSettings: async (data: TenantMarketplaceSettingsInput, tenantId?: number): Promise<TenantMarketplaceSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/settings`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar regras de marketplace');
    return body;
  },

  saveMarketplaceAccount: async (data: MarketplaceAccountInput, tenantId?: number): Promise<MarketplaceAccount> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/accounts`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar conta de marketplace');
    return body;
  },

  startMarketplaceOAuth: async (provider: string, redirectUri: string, tenantId?: number): Promise<MarketplaceOAuthStartResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/oauth/start`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider, redirect_uri: redirectUri }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao iniciar OAuth do marketplace');
    return body;
  },

  completeMarketplaceOAuth: async (
    data: { provider: string; code: string; state?: string; shop_id?: string; seller_id?: string; redirect_uri?: string },
    tenantId?: number
  ): Promise<{ account: MarketplaceAccount; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/oauth/callback`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao registrar callback OAuth');
    return body;
  },

  saveMarketplaceMapping: async (data: MarketplaceProductMappingInput, tenantId?: number): Promise<MarketplaceProductMapping> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/mappings`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar mapeamento de SKU');
    return body;
  },

  importMarketplaceProducts: async (data: MarketplaceProductImportInput, tenantId?: number): Promise<MarketplaceProductImportResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/import-products`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao importar catalogo do marketplace');
    return body;
  },

  syncMarketplaceProducts: async (provider?: string, tenantId?: number): Promise<{ imported: number; updated: number; events_processed: number; results: Array<{ provider: string; status: string; imported: number; updated: number; events_processed: number; message: string }> }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/sync-products`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao sincronizar catalogo dos marketplaces');
    return body;
  },

  syncMarketplaceOrders: async (provider?: string, days = 7, tenantId?: number): Promise<{ days: number; imported: number; results: Array<{ provider: string; status: string; imported: number; message: string }> }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/sync-orders`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider, days }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao sincronizar pedidos dos marketplaces');
    return body;
  },

  refreshMarketplaceTokens: async (provider?: string, tenantId?: number): Promise<{ refreshed: number; results: Array<{ provider: string; status: string; message: string }> }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/refresh-tokens`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao renovar token do marketplace');
    return body;
  },

  testMarketplaceConnection: async (provider: string, tenantId?: number): Promise<{ message: string; account: MarketplaceAccount }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/test`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao testar marketplace');
    return body;
  },

  getExternalMarketplaceOrders: async (tenantId?: number, provider?: string): Promise<ExternalMarketplaceOrder[]> => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/external-orders?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar pedidos externos');
    return res.json();
  },

  syncProductToMarketplace: async (productId: number, provider: string, tenantId?: number): Promise<{ message: string; mapping: MarketplaceProductMapping }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/sync-product`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ product_id: productId, provider }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar produto com o marketplace');
    return data;
  }
};
