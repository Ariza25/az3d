import { User } from './auth';
import { PrintingPricingInput } from './pricing';

export interface Category {
  id: number;
  tenant_id?: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export interface ProductColorImage {
  id?: number;
  tenant_id?: number;
  product_id?: number;
  color_name: string;
  image_url: string;
  video_url?: string;
  sort_order: number;
}

export interface ProductReviewSummary {
  average_rating: number;
  review_count: number;
}

export interface ProductVariant {
  id?: number;
  tenant_id?: number;
  product_id?: number;
  color_name: string;
  variation_name?: string;
  attributes?: string;
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

export interface ProductReview {
  id: number;
  tenant_id: number;
  product_id: number;
  user_id: number;
  user?: User;
  rating: number;
  comment?: string;
  image_url?: string;
  is_verified_buyer?: boolean;
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
  video_url?: string;
  model_3d_url?: string;
  supported_materials?: string[];
  infill_options?: number[];
  layer_heights?: string[];
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
  slicer_settings?: string;
  pricing_snapshot?: PrintingPricingInput;
  in_stock: boolean;
  stock_qty: number;
  status: 'draft' | 'active' | 'paused' | string;
  source_provider?: string;
  source_external_id?: string;
  source_synced_at?: string;
  created_at?: string;
  updated_at?: string;
  /** Store-only grouping for marketplace listings that represent color siblings. */
  store_variants?: Product[];
  /** Store-only label inferred from the marketplace title/SKU. */
  store_variant_color?: string;
  sales_count?: number;
}

export interface StockAlert {
  product_id: number;
  product: Product;
  color_name?: string;
  stock_qty: number;
  threshold: number;
  severity: 'out' | 'critical' | 'low' | string;
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
  video_url?: string;
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
  model_3d_url?: string;
  slicer_settings?: string;
  pricing_snapshot?: PrintingPricingInput;
}
