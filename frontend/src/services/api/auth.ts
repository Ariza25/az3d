import { AuthResponse, User, ForgotPasswordResponse, VerifyResetTokenResponse, ResetPasswordResponse } from '../../types';
import { API_BASE_URL, CUSTOMER_TOKEN_KEY, ADMIN_TOKEN_KEY, getHeaders, getAdminHeaders } from './client';

export const authApi = {
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

  login: async (email: string, password: string): Promise<AuthResponse> => authApi.customerLogin(email, password),

  register: async (name: string, email: string, password: string, tenantId?: number): Promise<AuthResponse> =>
    authApi.customerRegister(name, email, password, tenantId),

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

  updateMe: async (payload: Partial<User>, tokenKey: string = CUSTOMER_TOKEN_KEY): Promise<User> => {
    const body: Record<string, unknown> = { ...payload };
    if (typeof payload.addresses === 'object') {
      body.addresses = JSON.stringify(payload.addresses);
    }
    if (typeof payload.saved_cards === 'object') {
      body.saved_cards = JSON.stringify(payload.saved_cards);
    }

    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'PUT',
      headers: getHeaders(undefined, tokenKey),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil do usuário');
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

  forgotPassword: async (email: string, accountType?: string): Promise<ForgotPasswordResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, account_type: accountType || '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao solicitar recuperação de senha');
    return data;
  },

  verifyResetToken: async (token: string): Promise<VerifyResetTokenResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao validar token');
    return data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha');
    return data;
  },
};
