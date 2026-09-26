import {
  Tenant,
  TenantSettings,
  PlatformOverview,
  ObservabilityHealth,
  WebhookLogItem,
  PlatformEnvironment,
  MercadoPagoPlatformConfig,
  MercadoLivrePlatformConfig,
  MasterOAuthStartResponse,
  TenantPaymentAccountStatus,
} from '../../types';
import { API_BASE_URL, getHeaders, getAdminHeaders, readJsonResponse } from './client';

export const tenantsApi = {
  getTenants: async (): Promise<Tenant[]> => {
    const res = await fetch(`${API_BASE_URL}/tenants`);
    return readJsonResponse<Tenant[]>(res, 'Falha ao carregar lista de lojas (tenants)');
  },

  getTenantByIdentifier: async (identifier: string): Promise<Tenant> => {
    const res = await fetch(`${API_BASE_URL}/tenants/${encodeURIComponent(identifier)}`);
    return readJsonResponse<Tenant>(res, 'Loja não encontrada');
  },

  getTenantSettings: async (tenantId?: number): Promise<TenantSettings> => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', String(tenantId));
    const url = params.toString() ? `${API_BASE_URL}/tenant/settings?${params.toString()}` : `${API_BASE_URL}/tenant/settings`;
    const res = await fetch(url, {
      headers: getHeaders(tenantId),
    });
    return readJsonResponse<TenantSettings>(res, 'Falha ao carregar configurações da loja');
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
      method: 'POST',
      headers: getAdminHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao iniciar autorizacao Mercado Livre');
    return body;
  },

  startMasterMercadoPagoOAuth: async (tenantId: number): Promise<MasterOAuthStartResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/platform/tenants/${tenantId}/payments/mercadopago/oauth/start`, {
      method: 'POST',
      headers: getAdminHeaders(),
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
      method: 'POST',
      headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao iniciar conexao Mercado Pago');
    return body;
  },

  refreshTenantMercadoPagoOAuth: async (tenantId?: number): Promise<TenantPaymentAccountStatus> => {
    const res = await fetch(`${API_BASE_URL}/admin/payments/mercadopago/oauth/refresh`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao renovar conexao Mercado Pago');
    return body;
  },

  disconnectTenantMercadoPagoOAuth: async (tenantId?: number): Promise<TenantPaymentAccountStatus> => {
    const res = await fetch(`${API_BASE_URL}/admin/payments/mercadopago/oauth`, {
      method: 'DELETE',
      headers: getAdminHeaders(tenantId),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Erro ao desconectar Mercado Pago');
    return body;
  },
};
