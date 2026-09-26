import {
  TenantCarrierAccount,
  TenantCarrierAccountInput,
  CarrierHealthItem,
  OrderShipment,
  OrderShipmentInput,
  TrackingSyncEntry,
  TrackingSyncSummary,
} from '../../types';
import {
  API_BASE_URL,
  getHeaders,
  getAdminHeaders,
} from './client';

export const shippingApi = {
  getCarrierAccounts: async (tenantId?: number): Promise<TenantCarrierAccount[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/carrier-accounts`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao carregar contas de transportadora');
    return res.json();
  },

  saveCarrierAccount: async (
    data: TenantCarrierAccountInput,
    tenantId?: number
  ): Promise<TenantCarrierAccount> => {
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

  calculateFreightQuote: async (
    zipCode: string,
    tenantId?: number
  ): Promise<{ options: { code: string; name: string; price: number; delivery_days: number }[] }> => {
    const res = await fetch(`${API_BASE_URL}/shipping/calculate-quote`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify({ zip_code: zipCode, tenant_id: tenantId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao calcular frete');
    return data;
  },
};
