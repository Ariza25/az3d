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
  origin_cep?: string;
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
  origin_cep?: string;
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
  dimensions?: string;
  material?: string;
  layerHeight?: string;
  slicerSettings?: string;
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
  product?: any;
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
