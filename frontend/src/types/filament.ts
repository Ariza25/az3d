export interface FilamentUsageLog {
  id: number;
  tenant_id: number;
  spool_id: number;
  order_id?: number;
  grams_used: number;
  description: string;
  created_at: string;
}

export interface FilamentSpool {
  id: number;
  tenant_id: number;
  name: string;
  material_type: 'PLA' | 'ABS' | 'PETG' | 'TPU' | 'Resin' | string;
  color_name: string;
  color_hex: string;
  spool_weight_g: number;
  remaining_weight_g: number;
  price_per_kg: number;
  vendor?: string;
  is_active: boolean;
  logs?: FilamentUsageLog[];
  created_at?: string;
}

export interface OrderFilamentItemCheck {
  order_item_id: number;
  product_id: number;
  product_title: string;
  product_image?: string;
  color: string;
  material: string;
  quantity: number;
  unit_weight_grams: number;
  total_required_grams: number;
  matching_spool_id?: number;
  matching_spool_name?: string;
  matching_spool_vendor?: string;
  spool_remaining_grams?: number;
  is_sufficient: boolean;
  missing_grams: number;
}

export interface OrderFilamentCheckResult {
  order_id: number;
  can_produce: boolean;
  items: OrderFilamentItemCheck[];
  warnings: string[];
}

export interface DeductFilamentInput {
  spool_id: number;
  order_id?: number;
  grams: number;
  description?: string;
}
