import { Product } from './products';

export interface MarketplaceProductMapping {
  id: number;
  tenant_id: number;
  product_id: number;
  product?: Product;
  provider: string;
  internal_sku?: string;
  external_sku?: string;
  external_title?: string;
  external_item_id: string;
  external_url: string;
  sync_status: string;
  last_synced_at?: string;
}

export interface MarketplaceAccount {
  id: number;
  tenant_id: number;
  provider: 'mercadolivre' | 'shopee' | 'amazon' | string;
  account_name: string;
  seller_id?: string;
  shop_id?: string;
  marketplace?: string;
  token_expires_at?: string;
  is_active: boolean;
  is_connected: boolean;
  sync_orders: boolean;
  sync_catalog: boolean;
  sync_stock: boolean;
  sync_status: string;
  last_sync_at?: string;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MarketplaceAccountInput {
  provider: string;
  account_name?: string;
  seller_id?: string;
  shop_id?: string;
  marketplace?: string;
  access_token?: string;
  refresh_token?: string;
  is_active: boolean;
  sync_orders: boolean;
  sync_catalog?: boolean;
  sync_stock: boolean;
}

export interface TenantMarketplaceSettings {
  id: number;
  tenant_id: number;
  marketplace_controls_price: boolean;
  marketplace_controls_stock: boolean;
  content_sync_policy: 'imported_only' | 'always' | 'never' | string;
  new_imported_product_status: 'draft' | 'active' | string;
  auto_create_internal_orders: boolean;
  auto_create_financial_entries: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TenantMarketplaceSettingsInput {
  marketplace_controls_price: boolean;
  marketplace_controls_stock: boolean;
  content_sync_policy: string;
  new_imported_product_status: string;
  auto_create_internal_orders: boolean;
  auto_create_financial_entries: boolean;
}

export interface MarketplaceOAuthStartResponse {
  provider: string;
  state: string;
  auth_url: string;
  missing_config: string[];
  mode: string;
}

export interface ExternalMarketplaceOrderItem {
  id: number;
  tenant_id: number;
  external_order_id_ref: number;
  product_id?: number;
  product?: Product;
  provider: string;
  external_item_id: string;
  external_sku: string;
  title: string;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  fee_amount: number;
  discount_amount: number;
}

export interface ExternalMarketplaceOrder {
  id: number;
  tenant_id: number;
  provider: string;
  external_order_id: string;
  external_status: string;
  currency: string;
  gross_amount: number;
  items_amount: number;
  shipping_cost: number;
  marketplace_fees: number;
  discount_amount: number;
  net_amount: number;
  buyer_nickname?: string;
  internal_order_id?: number;
  items?: ExternalMarketplaceOrderItem[];
  ordered_at: string;
  synced_at: string;
  raw_payload?: string;
}

export interface MLTrendKeyword {
  keyword: string;
  url?: string;
  category?: string;
  rank: number;
  status: 'hot' | 'rising' | 'stable' | string;
  search_vol: number;
  volume_trend: number[];
}

export interface MLCompetitorItem {
  id: string;
  title: string;
  price: number;
  sold_quantity: number;
  permalink: string;
  thumbnail: string;
  condition: string;
  free_shipping: boolean;
  mercado_lider: boolean;
  full_shipping: boolean;
}

export interface MLSearchInsight {
  query: string;
  total_results: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  median_sold: number;
  free_shipping_ratio: number;
  mercado_lider_ratio: number;
  full_ratio: number;
  recommended_price: number;
  estimated_print_cost: number;
  estimated_profit: number;
  profit_margin_percent: number;
  top_sellers: MLCompetitorItem[];
}

export interface MLListingAudit {
  item_id?: string;
  title: string;
  health_score: number;
  title_score: number;
  image_score: number;
  price_score: number;
  shipping_score: number;
  title_length: number;
  has_keywords: boolean;
  image_count: number;
  price: number;
  free_shipping: boolean;
  recommendations: string[];
  missing_keywords: string[];
}

export interface MLProductOpportunity {
  id: string;
  category: string;
  title: string;
  demand_level: string;
  competition_level: string;
  suggested_price: number;
  estimated_print_grams: number;
  estimated_print_hours: number;
  estimated_cost: number;
  estimated_profit: number;
  profit_margin_percent: number;
  opportunity_score: number;
  target_keywords: string[];
}
