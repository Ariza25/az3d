import {
  FilamentSpool,
  FilamentUsageLog,
  OrderFilamentCheckResult,
  DeductFilamentInput,
} from '../../types';
import {
  API_BASE_URL,
  getAdminHeaders,
} from './client';

export const filamentsApi = {
  // Filamentos e Insumos 3D
  getFilamentSpools: async (tenantId?: number): Promise<FilamentSpool[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao buscar carretéis de filamento');
    return res.json();
  },

  createFilamentSpool: async (
    payload: Partial<FilamentSpool>,
    tenantId?: number
  ): Promise<FilamentSpool> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar filamento');
    return data;
  },

  updateFilamentSpool: async (
    id: number,
    payload: Partial<FilamentSpool>,
    tenantId?: number
  ): Promise<FilamentSpool> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar filamento');
    return data;
  },

  deleteFilamentSpool: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao excluir filamento');
  },

  getFilamentLogs: async (spoolId: number, tenantId?: number): Promise<FilamentUsageLog[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments/${spoolId}/logs`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao buscar histórico de consumo do filamento');
    return res.json();
  },

  deductFilament: async (
    payload: DeductFilamentInput,
    tenantId?: number
  ): Promise<{ message: string; spool: FilamentSpool; log: FilamentUsageLog }> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments/deduct`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao abater peso de filamento');
    return data;
  },

  checkOrderFilament: async (orderId: number, tenantId?: number): Promise<OrderFilamentCheckResult> => {
    const res = await fetch(`${API_BASE_URL}/admin/filaments/check-order/${orderId}`, {
      headers: getAdminHeaders(tenantId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao verificar disponibilidade de filamento');
    return data;
  },
};
