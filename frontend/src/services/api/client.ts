export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
      return '/api';
    }
  }
  return 'http://localhost:8080/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const resolveApiAssetUrl = (path: string) => {
  if (!path || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin;
  const apiOrigin = new URL(base, window.location.origin).origin;
  return new URL(path.startsWith('/') ? path : `/${path}`, apiOrigin).toString();
};

export const CUSTOMER_TOKEN_KEY = 'az3d_customer_token';
export const ADMIN_TOKEN_KEY = 'az3d_admin_token';

export const getHeaders = (
  tenantId?: number,
  tokenKey: string = CUSTOMER_TOKEN_KEY,
  accessToken?: string | null,
) => {
  const token = accessToken === undefined ? localStorage.getItem(tokenKey) : accessToken;
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

export const getAdminHeaders = (tenantId?: number) => getHeaders(tenantId, ADMIN_TOKEN_KEY);

export const getUploadHeaders = (tenantId?: number) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const storedTenant = tenantId || localStorage.getItem('az3d_tenant_id') || '1';
  const headers: Record<string, string> = {
    'X-Tenant-ID': String(storedTenant),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const extractApiErrorMessage = (body: unknown, response: Response, fallbackMessage: string): string => {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
    if (typeof obj.msg === 'string' && obj.msg.trim()) return obj.msg.trim();
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      return obj.errors
        .map((e: unknown) => typeof e === 'string' ? e : (e as any)?.message || JSON.stringify(e))
        .join('; ');
    }
  }

  if (response.status === 401) {
    return 'Sessão expirada ou não autorizada. Por favor, faça login novamente.';
  }
  if (response.status === 403) {
    return 'Acesso negado. Você não possui permissão para executar esta ação.';
  }
  if (response.status === 404) {
    return `${fallbackMessage}: registro não encontrado.`;
  }
  if (response.status === 409) {
    return 'Já existe um registro cadastrado com estes mesmos dados (nome ou identificador duplicado).';
  }
  if (response.status === 422) {
    return `${fallbackMessage}: dados fornecidos são inválidos ou incompletos.`;
  }
  if (response.status >= 500) {
    return `${fallbackMessage} (Erro no servidor: HTTP ${response.status}).`;
  }

  const statusSuffix = response.status ? ` (HTTP ${response.status})` : '';
  return `${fallbackMessage}${statusSuffix}`;
};

export const readJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(null, response, fallbackMessage));
      }
      throw new Error(`${fallbackMessage}: resposta inválida do servidor`);
    }
  }

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(body, response, fallbackMessage));
  }

  if (body === null) {
    return undefined as unknown as T;
  }
  return body as T;
};
