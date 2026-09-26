import {
  ChatMessage,
  ChatConversation,
  ChatConversationResponse,
} from '../../types';
import {
  API_BASE_URL,
  CUSTOMER_TOKEN_KEY,
  getHeaders,
  getAdminHeaders,
} from './client';

export const chatApi = {
  // Chat Online - Comprador
  getCustomerChatConversation: async (tenantId: number): Promise<ChatConversationResponse> => {
    const res = await fetch(`${API_BASE_URL}/chat/tenant/${tenantId}/conversation`, {
      headers: getHeaders(tenantId, CUSTOMER_TOKEN_KEY),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao conectar ao chat');
    return data;
  },

  sendCustomerChatMessage: async (tenantId: number, message: string): Promise<ChatMessage> => {
    const res = await fetch(`${API_BASE_URL}/chat/tenant/${tenantId}/messages`, {
      method: 'POST',
      headers: getHeaders(tenantId, CUSTOMER_TOKEN_KEY),
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar mensagem');
    return data;
  },

  // Chat Online - Tenant Admin
  getTenantChatConversations: async (tenantId?: number): Promise<ChatConversation[]> => {
    const res = await fetch(`${API_BASE_URL}/admin/chat/conversations`, {
      headers: getAdminHeaders(tenantId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao listar conversas do chat');
    return data;
  },

  getTenantChatMessages: async (conversationId: number, tenantId?: number): Promise<ChatConversationResponse> => {
    const res = await fetch(`${API_BASE_URL}/admin/chat/conversations/${conversationId}/messages`, {
      headers: getAdminHeaders(tenantId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar mensagens');
    return data;
  },

  sendTenantChatMessage: async (
    conversationId: number,
    message: string,
    tenantId?: number
  ): Promise<ChatMessage> => {
    const res = await fetch(`${API_BASE_URL}/admin/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getAdminHeaders(tenantId),
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar resposta');
    return data;
  },

  getTenantChatUnreadCount: async (tenantId?: number): Promise<{ unread_count: number }> => {
    const res = await fetch(`${API_BASE_URL}/admin/chat/unread-count`, {
      headers: getAdminHeaders(tenantId),
    });
    const data = await res.json();
    if (!res.ok) return { unread_count: 0 };
    return data;
  },
};
