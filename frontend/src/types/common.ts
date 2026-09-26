export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_more: boolean;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  tenant_id: number;
  sender_id: number;
  sender_type: 'customer' | 'tenant';
  sender_name: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  tenant_id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  last_message: string;
  last_message_at: string;
  unread_tenant_count: number;
  unread_customer_count: number;
  messages?: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatConversationResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
}
