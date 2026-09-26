import {
  Category,
  Product,
  PaginatedResponse,
  ProductInput,
  ProductReview,
  ProductFavorite,
  StockMovement,
  StockAlert,
  StockAdjustmentInput,
  Parsed3MFResult,
} from '../../types';
import { API_BASE_URL, getHeaders, getAdminHeaders, getUploadHeaders, readJsonResponse } from './client';

export const productsApi = {
  getCategories: async (tenantId?: number): Promise<Category[]> => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', String(tenantId));
    const url = params.toString() ? `${API_BASE_URL}/categories?${params.toString()}` : `${API_BASE_URL}/categories`;
    const res = await fetch(url, {
      headers: getHeaders(tenantId),
    });
    return readJsonResponse<Category[]>(res, 'Falha ao carregar categorias');
  },

  createCategory: async (categoryData: { name: string; description?: string; icon?: string }, tenantId?: number): Promise<Category> => {
    const res = await fetch(`${API_BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(categoryData),
    });

    return readJsonResponse<Category>(res, 'Erro ao criar categoria');
  },

  getProducts: async (
    category?: string,
    query?: string,
    tenantId?: number,
    page?: number,
    limit?: number,
    sortBy?: string
  ): Promise<Product[] | PaginatedResponse<Product>> => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', String(tenantId));
    if (category && category !== 'todas') params.append('category', category);
    if (query) params.append('q', query);
    const effectiveSort = (!sortBy || sortBy === 'featured') ? 'name' : sortBy;
    params.append('sort', effectiveSort);
    if (page !== undefined && page > 0) {
      params.append('page', String(page));
      params.append('paginated', 'true');
    }
    if (limit !== undefined && limit > 0) params.append('limit', String(limit));

    let res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok && res.status >= 500 && params.get('sort') !== 'name') {
      params.set('sort', 'name');
      res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        headers: getHeaders(tenantId),
      });
    }
    return readJsonResponse<Product[] | PaginatedResponse<Product>>(res, 'Falha ao carregar produtos');
  },

  getPaginatedProducts: async (
    category?: string,
    query?: string,
    tenantId?: number,
    page: number = 1,
    limit: number = 12,
    sortBy?: string
  ): Promise<PaginatedResponse<Product>> => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', String(tenantId));
    if (category && category !== 'todas') params.append('category', category);
    if (query) params.append('q', query);
    const effectiveSort = (!sortBy || sortBy === 'featured') ? 'name' : sortBy;
    params.append('sort', effectiveSort);
    params.append('page', String(page));
    params.append('limit', String(limit));
    params.append('paginated', 'true');

    let res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok && res.status >= 500 && params.get('sort') !== 'name') {
      params.set('sort', 'name');
      res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        headers: getHeaders(tenantId),
      });
    }
    return readJsonResponse<PaginatedResponse<Product>>(res, 'Falha ao carregar produtos paginados');
  },

  getProductById: async (id: number, tenantId?: number): Promise<Product> => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', String(tenantId));
    const url = params.toString() ? `${API_BASE_URL}/products/${id}?${params.toString()}` : `${API_BASE_URL}/products/${id}`;
    const res = await fetch(url, {
      headers: getHeaders(tenantId),
    });
    return readJsonResponse<Product>(res, 'Produto não encontrado');
  },

  createProduct: async (productData: ProductInput, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/admin/products`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(productData),
    });

    return readJsonResponse<Product>(res, 'Erro ao cadastrar novo produto');
  },

  getAdminProducts: async (tenantId?: number, query?: string): Promise<Product[]> => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    const res = await fetch(`${API_BASE_URL}/admin/products?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    return readJsonResponse<Product[]>(res, 'Erro ao buscar produtos do admin');
  },

  updateProduct: async (id: number, productData: ProductInput, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(productData),
    });

    return readJsonResponse<Product>(res, 'Erro ao atualizar produto');
  },

  deleteProduct: async (id: number, tenantId?: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(tenantId),
    });

    return readJsonResponse<void>(res, 'Erro ao excluir produto');
  },

  getProductReviews: async (productId: number, tenantId?: number): Promise<ProductReview[]> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('Falha ao carregar avaliacoes');
    return res.json();
  },

  saveProductReview: async (productId: number, rating: number, comment = '', imageUrl = '', tenantId?: number): Promise<ProductReview> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
      method: 'POST',
      headers: getHeaders(tenantId),
      body: JSON.stringify({ rating, comment, image_url: imageUrl }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar avaliacao');
    return data;
  },

  checkReviewEligibility: async (productId: number, tenantId?: number): Promise<{ can_review: boolean; is_verified_buyer: boolean }> => {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/review-eligibility`, {
      headers: getHeaders(tenantId),
    });
    if (!res.ok) return { can_review: false, is_verified_buyer: false };
    return res.json();
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

  getStockMovements: async (tenantId?: number, productId?: number): Promise<StockMovement[]> => {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', String(productId));
    const res = await fetch(`${API_BASE_URL}/admin/stock-movements?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    return readJsonResponse<StockMovement[]>(res, 'Erro ao carregar histórico de estoque');
  },

  getStockAlerts: async (tenantId?: number, threshold = 3): Promise<StockAlert[]> => {
    const params = new URLSearchParams();
    params.append('threshold', String(threshold));
    const res = await fetch(`${API_BASE_URL}/admin/stock-alerts?${params.toString()}`, {
      headers: getAdminHeaders(tenantId),
    });
    return readJsonResponse<StockAlert[]>(res, 'Erro ao carregar alertas de estoque');
  },

  adjustStock: async (input: StockAdjustmentInput, tenantId?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE_URL}/admin/stock-adjustments`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify(input),
    });
    return readJsonResponse<Product>(res, 'Erro ao ajustar estoque');
  },

  parse3MF: async (file: File, tenantId?: number): Promise<Parsed3MFResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/admin/pricing/parse-3mf`, {
      method: 'POST',
      headers: getUploadHeaders(tenantId),
      body: formData,
    });

    return readJsonResponse<Parsed3MFResult>(res, 'Falha ao processar arquivo .3mf');
  },

  uploadProductImage: async (file: File, tenantId?: number): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/admin/uploads/products`, {
      method: 'POST',
      headers: getUploadHeaders(tenantId),
      body: formData,
    });

    return readJsonResponse<{ url: string }>(res, 'Erro ao enviar imagem');
  },
};
