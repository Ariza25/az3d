import {
  MarketplaceProductMapping,
  MarketplaceAccount,
  MarketplaceAccountInput,
  MarketplaceOAuthStartResponse,
  ExternalMarketplaceOrder,
  TenantMarketplaceSettings,
  TenantMarketplaceSettingsInput,
  MLTrendKeyword,
  MLSearchInsight,
  MLListingAudit,
  MLProductOpportunity,
} from '../../types';
import {
  API_BASE_URL,
  getAdminHeaders,
} from './client';

export const marketplaceApi = {
  // --- MARKETPLACES (Mercado Livre, Shopee, Amazon) ---

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

  updateMarketplaceSettings: async (
    data: TenantMarketplaceSettingsInput,
    tenantId?: number
  ): Promise<TenantMarketplaceSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/settings`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar regras de marketplace');
    return body;
  },

  saveMarketplaceAccount: async (
    data: MarketplaceAccountInput,
    tenantId?: number
  ): Promise<MarketplaceAccount> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/accounts`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar conta de marketplace');
    return body;
  },

  startMarketplaceOAuth: async (
    provider: string,
    redirectUri: string,
    tenantId?: number
  ): Promise<MarketplaceOAuthStartResponse> => {
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

  disconnectMarketplaceAccount: async (
    provider: string,
    tenantId?: number
  ): Promise<{ account: MarketplaceAccount; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/disconnect`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao desconectar conta do marketplace');
    return body;
  },

  syncMarketplaceProducts: async (
    provider?: string,
    tenantId?: number
  ): Promise<{
    imported: number;
    updated: number;
    events_processed: number;
    results: Array<{ provider: string; status: string; imported: number; updated: number; events_processed: number; message: string }>;
  }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/sync-products`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao sincronizar catalogo dos marketplaces');
    return body;
  },

  syncMarketplaceOrders: async (
    provider?: string,
    days = 7,
    tenantId?: number
  ): Promise<{
    days: number;
    imported: number;
    results: Array<{ provider: string; status: string; imported: number; message: string }>;
  }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/sync-orders`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider, days }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao sincronizar pedidos dos marketplaces');
    return body;
  },

  refreshMarketplaceTokens: async (
    provider?: string,
    tenantId?: number
  ): Promise<{
    refreshed: number;
    results: Array<{ provider: string; status: string; message: string }>;
  }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/refresh-tokens`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao renovar token do marketplace');
    return body;
  },

  testMarketplaceConnection: async (
    provider: string,
    tenantId?: number
  ): Promise<{ message: string; account: MarketplaceAccount }> => {
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/test`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ provider }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao testar marketplace');
    return body;
  },

  getExternalMarketplaceOrders: async (
    tenantId?: number,
    provider?: string
  ): Promise<ExternalMarketplaceOrder[]> => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/external-orders?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar pedidos externos');
    return res.json();
  },

  // Mercado Livre & Shopee Trends & Market Intelligence
  getMLTrends: async (
    category?: string,
    provider = 'mercadolivre',
    tenantId?: number
  ): Promise<{ category?: string; provider?: string; trends: MLTrendKeyword[] }> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (provider) params.append('provider', provider);
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/trends?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar tendências do marketplace');
    return res.json();
  },

  getMLSearchInsights: async (
    query?: string,
    provider = 'mercadolivre',
    tenantId?: number
  ): Promise<MLSearchInsight> => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (provider) params.append('provider', provider);
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/search-insights?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao analisar concorrência no marketplace');
    return res.json();
  },

  auditMLListing: async (
    params: {
      title?: string;
      price?: number;
      images?: number;
      free_shipping?: boolean;
      full_shipping?: boolean;
      material?: string;
      provider?: string;
    },
    tenantId?: number
  ): Promise<MLListingAudit> => {
    const urlParams = new URLSearchParams();
    if (params.title) urlParams.append('title', params.title);
    if (params.price) urlParams.append('price', String(params.price));
    if (params.images) urlParams.append('images', String(params.images));
    if (params.free_shipping) urlParams.append('free_shipping', 'true');
    if (params.full_shipping) urlParams.append('full_shipping', 'true');
    if (params.material) urlParams.append('material', params.material);
    if (params.provider) urlParams.append('provider', params.provider);
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/listing-audit?${urlParams.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao realizar auditoria do anúncio');
    return res.json();
  },

  getMLProductOpportunities: async (
    category?: string,
    provider = 'mercadolivre',
    tenantId?: number
  ): Promise<{ category?: string; provider?: string; opportunities: MLProductOpportunity[] }> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (provider) params.append('provider', provider);
    const res = await fetch(`${API_BASE_URL}/admin/marketplaces/product-opportunities?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao buscar oportunidades de produtos 3D');
    return res.json();
  },
};
