export interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
}

export interface User {
  id: number;
  tenant_id?: number;
  name: string;
  username?: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Category {
  id: number;
  tenant_id?: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export interface Product {
  id: number;
  tenant_id?: number;
  title: string;
  slug: string;
  sku?: string;
  description: string;
  price: number;
  rating?: number;
  review_count?: number;
  image_url: string;
  color_images?: ProductColorImage[];
  review_summary?: ProductReviewSummary;
  variants?: ProductVariant[];
  color_stocks?: ProductColorStock[];
  category_id: number;
  category?: Category;
  material: string;
  layer_height: string;
  print_time: string;
  dimensions: string;
  weight: string;
  in_stock: boolean;
  stock_qty: number;
  status: 'draft' | 'active' | 'paused' | string;
  source_provider?: string;
  source_external_id?: string;
  source_synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductColorImage {
  id?: number;
  tenant_id?: number;
  product_id?: number;
  color_name: string;
  image_url: string;
  sort_order: number;
}

export interface ProductReviewSummary {
  average_rating: number;
  review_count: number;
}

export interface ProductReview {
  id: number;
  tenant_id: number;
  product_id: number;
  user_id: number;
  user?: User;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductFavorite {
  id: number;
  tenant_id: number;
  product_id: number;
  product?: Product;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id?: number;
  tenant_id?: number;
  product_id?: number;
  color_name: string;
  price: number;
  material?: string;
  layer_height?: string;
  print_time?: string;
  weight?: string;
  is_active: boolean;
  sort_order: number;
}

export interface ProductColorStock {
  id?: number;
  tenant_id?: number;
  product_id?: number;
  color_name: string;
  stock_qty: number;
}

export interface StockMovement {
  id: number;
  tenant_id: number;
  product_id: number;
  product?: Product;
  order_id?: number;
  color_name?: string;
  movement_type: string;
  quantity_delta: number;
  quantity_after: number;
  reason?: string;
  created_at: string;
}

export interface StockAdjustmentInput {
  product_id: number;
  color_name?: string;
  stock_qty: number;
  reason?: string;
}

export interface ProductInput {
  title: string;
  slug?: string;
  sku?: string;
  description: string;
  price: number;
  image_url: string;
  color_images?: ProductColorImage[];
  category_id: number;
  material: string;
  layer_height: string;
  print_time: string;
  dimensions: string;
  weight: string;
  in_stock: boolean;
  stock_qty: number;
  status?: string;
  variants?: ProductVariant[];
  color_stocks?: ProductColorStock[];
  pricing_snapshot?: PrintingPricingInput;
}

export interface CartItem {
  product: Product;
  quantity: number;
  color: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface OrderItemPayload {
  product_id: number;
  quantity: number;
  color: string;
}

export interface CreateOrderPayload {
  items: OrderItemPayload[];
  shipping_address: string;
  delivery_method?: 'shipping' | 'pickup' | string;
  recipient_name?: string;
  recipient_phone?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  color: string;
}

export interface Order {
  id: number;
  tenant_id?: number;
  user_id: number;
  user?: User;
  total_amount: number;
  status: string;
  items: OrderItem[];
  shipping_address: string;
  delivery_method?: string;
  recipient_name?: string;
  recipient_phone?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  notes?: string;
  payment_provider?: string;
  payment_status?: string;
  payment_id?: string;
  payment_detail?: string;
  mp_preference_id?: string;
  mp_init_point?: string;
  mp_sandbox_init_point?: string;
  paid_at?: string;
  created_at: string;
}

export interface CreateOrderResponse {
  message: string;
  order: Order;
  payment?: {
    provider: string;
    preference_id: string;
    checkout_url: string;
    sandbox_checkout_url?: string;
    status: string;
  };
}

export interface TenantSettings {
  id?: number;
  tenant_id: number;
  store_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  default_spool_price: number;
  default_spool_weight: number;
  default_printer_power_kw: number;
  default_energy_tariff: number;
  default_packaging_cost: number;
  default_labor_cost?: number;
  default_extra_cost?: number;
  default_failure_rate_percent: number;
  default_margin_percent: number;
  default_platform_fee_percent: number;
  default_payment_fee_percent: number;
  default_fixed_fee: number;
  delivery_pickup_enabled: boolean;
  delivery_ship_enabled: boolean;
}

export interface TenantStoreSettings {
  id?: number;
  tenant_id: number;
  store_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
}

export interface TenantPricingSettings {
  id?: number;
  tenant_id: number;
  default_spool_price: number;
  default_spool_weight: number;
  default_printer_power_kw: number;
  default_energy_tariff: number;
  default_packaging_cost: number;
  default_labor_cost: number;
  default_extra_cost: number;
  default_failure_rate_percent: number;
  default_margin_percent: number;
  default_platform_fee_percent: number;
  default_payment_fee_percent: number;
  default_fixed_fee: number;
}

export interface TenantFulfillmentSettings {
  id?: number;
  tenant_id: number;
  delivery_pickup_enabled: boolean;
  delivery_ship_enabled: boolean;
}

export interface MaterialPreset {
  id: number;
  tenant_id: number;
  name: string;
  material_type?: string;
  color_name?: string;
  spool_price: number;
  spool_weight_grams: number;
  is_default: boolean;
  is_active: boolean;
}

export interface PrinterPreset {
  id: number;
  tenant_id: number;
  name: string;
  power_kw: number;
  is_default: boolean;
  is_active: boolean;
}

export interface PlatformFeePreset {
  id: number;
  tenant_id: number;
  name: string;
  platform_fee_percent: number;
  payment_fee_percent: number;
  fixed_fee: number;
  is_default: boolean;
  is_active: boolean;
}

export interface TenantPricingBundle {
  store: TenantStoreSettings;
  pricing: TenantPricingSettings;
  fulfillment: TenantFulfillmentSettings;
  material_presets: MaterialPreset[];
  printer_presets: PrinterPreset[];
  platform_fee_presets: PlatformFeePreset[];
}

export interface PrintingPricingInput {
  productWeightGrams: number;
  supportWeightGrams: number;
  printMinutes: number;
  spoolPrice: number;
  spoolWeightGrams: number;
  printerPowerKw: number;
  energyTariffPerKwh: number;
  packagingCost: number;
  laborCost: number;
  extraCost: number;
  failureRatePercent: number;
  marginPercent: number;
  platformFeePercent: number;
  paymentFeePercent: number;
  fixedFee: number;
  materialPresetId?: number;
  printerPresetId?: number;
  platformFeePresetId?: number;
}

export interface PrintingPricingResult {
  totalMaterialGrams: number;
  materialCostPerGram: number;
  materialCost: number;
  energyKwh: number;
  energyCost: number;
  directCost: number;
  failureReserve: number;
  operationalCost: number;
  targetNetRevenue: number;
  variableFeeRate: number;
  variableFeeValue: number;
  fixedFee: number;
  totalFees: number;
  suggestedPrice: number;
  netAfterFees: number;
  profit: number;
  profitMarginPercent: number;
}

export interface PricingCalculationResponse {
  input: PrintingPricingInput;
  result: PrintingPricingResult;
}

export interface ProductPricingSnapshot {
  id: number;
  tenant_id: number;
  product_id: number;
  product_weight_grams: number;
  support_weight_grams: number;
  print_minutes: number;
  spool_price: number;
  spool_weight_grams: number;
  printer_power_kw: number;
  energy_tariff_per_kwh: number;
  packaging_cost: number;
  labor_cost: number;
  extra_cost: number;
  failure_rate_percent: number;
  margin_percent: number;
  platform_fee_percent: number;
  payment_fee_percent: number;
  fixed_fee: number;
  total_material_grams: number;
  material_cost_per_gram: number;
  material_cost: number;
  energy_kwh: number;
  energy_cost: number;
  direct_cost: number;
  failure_reserve: number;
  operational_cost: number;
  total_fees: number;
  suggested_price: number;
  net_after_fees: number;
  profit: number;
  profit_margin_percent: number;
  created_at: string;
}

export interface TenantFixedCost {
  id: number;
  tenant_id: number;
  name: string;
  monthly_amount: number;
  allocation_basis: string;
  is_active: boolean;
}

export interface ProductActualCost {
  id: number;
  tenant_id: number;
  product_id: number;
  product?: Product;
  order_id?: number;
  order_item_id?: number;
  actual_print_minutes: number;
  actual_material_grams: number;
  failed_material_grams: number;
  material_cost: number;
  energy_cost: number;
  packaging_cost: number;
  labor_cost: number;
  extra_cost: number;
  shipping_cost: number;
  marketplace_fee_amount: number;
  discount_amount: number;
  total_cost: number;
  notes?: string;
  created_at: string;
}

export interface ProductActualCostInput {
  product_id: number;
  order_id?: number;
  order_item_id?: number;
  actual_print_minutes: number;
  actual_material_grams: number;
  failed_material_grams: number;
  material_cost: number;
  energy_cost: number;
  packaging_cost: number;
  labor_cost: number;
  extra_cost: number;
  shipping_cost: number;
  marketplace_fee_amount: number;
  discount_amount: number;
  notes?: string;
}

export interface FinancialProductSummary {
  product_id: number;
  product_title: string;
  units_sold: number;
  gross_revenue: number;
  estimated_cost: number;
  estimated_fees: number;
  estimated_profit: number;
  estimated_margin_percent: number;
  actual_cost: number;
  actual_profit: number;
  actual_margin_percent: number;
}

export interface FinancialChannelSummary {
  provider: string;
  orders_count: number;
  units_sold: number;
  gross_revenue: number;
  marketplace_fees: number;
  shipping_cost: number;
  discount_amount: number;
  net_revenue: number;
  estimated_cost: number;
  estimated_profit: number;
  margin_percent: number;
  last_external_order?: string;
}

export interface FinancialSummary {
  gross_revenue: number;
  estimated_operational_cost: number;
  estimated_fees: number;
  fixed_costs_monthly: number;
  estimated_net_profit: number;
  estimated_margin_percent: number;
  actual_costs: number;
  actual_net_profit: number;
  actual_margin_percent: number;
  orders_count: number;
  units_sold: number;
  average_ticket: number;
  top_products: FinancialProductSummary[];
  low_margin_products: FinancialProductSummary[];
  channels: FinancialChannelSummary[];
}

export interface PresetInput {
  name: string;
  material_type?: string;
  color_name?: string;
  spool_price?: number;
  spool_weight_grams?: number;
  power_kw?: number;
  platform_fee_percent?: number;
  payment_fee_percent?: number;
  fixed_fee?: number;
  is_default: boolean;
  is_active: boolean;
}

export interface PricingScenarioResponse {
  scenarios: Array<{
    name: string;
    input: PrintingPricingInput;
    result: PrintingPricingResult;
    quantity: number;
    projected_profit: number;
  }>;
}

export interface MarketplaceIntegration {
  id: number;
  tenant_id: number;
  provider: 'mercadolivre' | 'shopee' | 'amazon' | string;
  seller_id: string;
  seller_name: string;
  is_active: boolean;
  sync_orders: boolean;
  sync_stock: boolean;
  created_at?: string;
}

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

export interface TenantCarrierAccount {
  id: number;
  tenant_id: number;
  provider: string;
  account_name: string;
  auth_type: string;
  token_expires_at?: string;
  is_active: boolean;
  is_connected: boolean;
  sync_tracking: boolean;
  last_sync_at?: string;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TenantCarrierAccountInput {
  provider: string;
  account_name?: string;
  auth_type?: string;
  is_active: boolean;
  sync_tracking: boolean;
  credentials?: Record<string, unknown>;
}

export interface MarketplaceOAuthStartResponse {
  provider: string;
  state: string;
  auth_url: string;
  missing_config: string[];
  mode: string;
}

export interface MarketplaceProductMappingInput {
  product_id: number;
  provider: string;
  internal_sku?: string;
  external_sku?: string;
  external_title?: string;
  external_item_id: string;
  external_url?: string;
}

export interface MarketplaceCatalogItemInput {
  external_item_id: string;
  external_sku?: string;
  external_title?: string;
  external_url?: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: number;
  material?: string;
  layer_height?: string;
  print_time?: string;
  dimensions?: string;
  weight?: string;
  stock_qty: number;
  status?: string;
  color_images?: ProductColorImage[];
  variants?: ProductVariant[];
  color_stocks?: ProductColorStock[];
}

export interface MarketplaceProductImportInput {
  provider: string;
  default_category_id?: number;
  overwrite_local: boolean;
  products: MarketplaceCatalogItemInput[];
}

export interface MarketplaceProductImportResult {
  action: 'created' | 'updated' | string;
  product: Product;
  mapping: MarketplaceProductMapping;
}

export interface MarketplaceProductImportResponse {
  provider: string;
  created: number;
  updated: number;
  results: MarketplaceProductImportResult[];
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
