import {
  TenantPricingBundle,
  PrintingPricingInput,
  PricingCalculationResponse,
  ProductPricingSnapshot,
  FinancialSummary,
  TenantFixedCost,
  ProductActualCost,
  ProductActualCostInput,
  PricingScenarioResponse,
  PresetInput,
  MaterialPreset,
  PrinterPreset,
  PlatformFeePreset,
  Product,
} from '../../types';
import { API_BASE_URL, getAdminHeaders } from './client';

export const pricingApi = {
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
};
