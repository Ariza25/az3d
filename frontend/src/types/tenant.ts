export interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
}

export interface PlatformTenantOverview {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  products_count: number;
  active_products_count: number;
  orders_count: number;
  open_orders_count: number;
  low_stock_count: number;
  marketplace_accounts: number;
  active_marketplace_count: number;
  carrier_accounts: number;
  active_carrier_count: number;
  connected_carrier_count: number;
  external_orders_count: number;
  marketplace_errors_count: number;
  carrier_errors_count: number;
  mercadolivre_connected: boolean;
  mercadopago_connected: boolean;
  last_order_at?: string;
  last_marketplace_sync_at?: string;
  last_carrier_sync_at?: string;
}

export interface PlatformOverview {
  tenants_count: number;
  products_count: number;
  orders_count: number;
  open_orders_count: number;
  low_stock_count: number;
  marketplace_accounts_count: number;
  carrier_accounts_count: number;
  payment_gateway_configured: boolean;
  webhook_secret_configured: boolean;
  generated_at: string;
  tenants: PlatformTenantOverview[];
}

export interface WebhookLogItem {
  id: number;
  tenant_id: number;
  provider: string;
  source: 'payment' | 'marketplace' | string;
  event_type: string;
  external_id: string;
  status: string;
  error?: string;
  received_at: string;
  processed_at?: string;
}

export interface ObservabilityHealth {
  status: string;
  database: string;
  scope: { all_tenants: boolean; tenant_id: number };
  failed_payment_webhooks_24h: number;
  failed_marketplace_webhooks_24h: number;
  marketplace_errors: number;
  carrier_errors: number;
  mercado_pago_configured: boolean;
  mercado_pago_webhook_secret: boolean;
  superfrete_configured?: boolean;
  checked_at: string;
}

export interface EnvironmentVariableStatus {
  key: string;
  category: string;
  configured: boolean;
  required: boolean;
  description: string;
}

export interface PlatformEnvironment {
  environment: string;
  service: string;
  version: string;
  database_required: boolean;
  max_upload_mb: number;
  tracking_sync_interval_minutes: number;
  variables: EnvironmentVariableStatus[];
  checked_at: string;
}

export interface MercadoPagoPlatformConfig {
  source: 'environment';
  configured: boolean;
  client_id_configured: boolean;
  client_secret_configured: boolean;
  redirect_uri_configured: boolean;
  webhook_secret_configured: boolean;
  missing: string[];
}

export interface MercadoLivrePlatformConfig {
  source: 'environment';
  configured: boolean;
  client_id_configured: boolean;
  client_secret_configured: boolean;
  redirect_uri_configured: boolean;
  missing: string[];
}

export interface MasterOAuthStartResponse {
  authorization_url: string;
  auth_url?: string;
}

export interface TenantPaymentAccountStatus {
  provider: 'mercadopago';
  oauth_available: boolean;
  connected: boolean;
  status: 'disconnected' | 'connected' | 'error' | string;
  seller_id?: string;
  public_key?: string;
  live_mode: boolean;
  token_expires_at?: string;
  connected_at?: string;
  last_error?: string;
}
