import {
  CreateOrderPayload,
  CreateOrderResponse,
  Order,
  OrderPaymentStatusResponse,
  Coupon,
  CouponInput,
  ValidateCouponResponse,
} from '../../types';
import {
  API_BASE_URL,
  CUSTOMER_TOKEN_KEY,
  getHeaders,
  getAdminHeaders,
  readJsonResponse,
} from './client';

export const ordersApi = {
  // Pedidos Cliente
  createOrder: async (
    payload: CreateOrderPayload,
    tenantId?: number,
    accessToken?: string
  ): Promise<CreateOrderResponse> => {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: getHeaders(tenantId, CUSTOMER_TOKEN_KEY, accessToken),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao finalizar pedido');
    return data;
  },

  getMyOrders: async (tenantId?: number, accessToken?: string): Promise<Order[]> => {
    const res = await fetch(`${API_BASE_URL}/orders/my-orders`, {
      headers: getHeaders(tenantId, CUSTOMER_TOKEN_KEY, accessToken),
    });
    if (!res.ok) throw new Error('Erro ao carregar histórico de pedidos');
    return res.json();
  },

  getOrderPaymentStatus: async (
    orderId: number,
    tenantId?: number,
    accessToken?: string
  ): Promise<OrderPaymentStatusResponse> => {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/payment-status`, {
      headers: getHeaders(tenantId, CUSTOMER_TOKEN_KEY, accessToken),
    });
    if (!res.ok) throw new Error('Erro ao consultar status de pagamento');
    return res.json();
  },

  // Pedidos Admin
  getAdminOrders: async (tenantId?: number): Promise<Order[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/orders`, {
      headers: getAdminHeaders(tenantId),
    });
    return readJsonResponse<Order[]>(res, 'Erro ao buscar pedidos do admin');
  },

  updateOrderStatus: async (
    orderId: number,
    status: string,
    tenantId?: number
  ): Promise<Order> => {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ status }),
    });

    return readJsonResponse<Order>(res, 'Erro ao atualizar status do pedido');
  },

  // Cupons
  validateCoupon: async (
    code: string,
    subtotal: number = 0,
    shipping: number = 0,
    tenantId?: number
  ): Promise<ValidateCouponResponse> => {
    const res = await fetch(`${API_BASE_URL}/coupons/validate`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify({ code, subtotal, shipping }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao validar cupom');
    return data;
  },

  getAdminCoupons: async (tenantId?: number): Promise<Coupon[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
      headers: getAdminHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Erro ao listar cupons');
    return res.json();
  },

  createAdminCoupon: async (coupon: CouponInput, tenantId?: number): Promise<Coupon> => {
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(coupon),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar cupom');
    return data;
  },

  updateAdminCoupon: async (
    id: number,
    coupon: Partial<CouponInput>,
    tenantId?: number
  ): Promise<Coupon> => {
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(coupon),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar cupom');
    return data;
  },

  deleteAdminCoupon: async (id: number, tenantId?: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(tenantId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir cupom');
    return data;
  },

  // Orçamentos 3D Customizados
  createCustom3DQuote: async (
    payload: {
      file_name: string;
      file_size_mb: number;
      material_type: string;
      infill_percent: number;
      estimated_weight_g: number;
      estimated_hours: number;
      estimated_price: number;
      customer_email?: string;
    },
    tenantId?: number
  ): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/quotes/custom-3d`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar orçamento 3D');
    return data;
  },

  // Cotação de Frete SuperFrete / Correios em Tempo Real
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
