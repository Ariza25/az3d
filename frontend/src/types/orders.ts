import { User } from './auth';
import { Product } from './products';
import { OrderShipment } from './shipping';

export interface CartItem {
  product: Product;
  quantity: number;
  color: string;
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
  coupon_code?: string;
  shipping_cost?: number;
  payment_method?: 'pix' | 'credit_card' | string;
  payer_cpf?: string;
  card_token?: string;
  card_number?: string;
  cardholder_name?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  card_cvv?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  original_price?: number;
  discount_percent?: number;
  color: string;
}

export interface Order {
  id: number;
  tenant_id?: number;
  user_id: number;
  user?: User;
  subtotal_amount?: number;
  shipping_cost?: number;
  coupon_code?: string;
  coupon_discount?: number;
  wholesale_discount?: number;
  discount_amount?: number;
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
  payment_method?: string;
  payment_status?: string;
  payment_id?: string;
  payment_detail?: string;
  pix_qr_code?: string;
  pix_qr_code_base64?: string;
  pix_expiration?: string;
  mp_preference_id?: string;
  mp_init_point?: string;
  mp_sandbox_init_point?: string;
  paid_at?: string;
  shipments?: OrderShipment[];
  created_at: string;
}

export interface CreateOrderResponse {
  message: string;
  order: Order;
  payment?: {
    provider: string;
    payment_method?: string;
    payment_id?: string;
    preference_id?: string;
    checkout_url?: string;
    sandbox_checkout_url?: string;
    status: string;
    status_detail?: string;
    pix_qr_code?: string;
    pix_qr_code_base64?: string;
    pix_expiration?: string;
    ticket_url?: string;
  };
}

export interface OrderPaymentStatusResponse {
  order_id: number;
  status: string;
  payment_status: string;
  payment_id?: string;
  payment_detail?: string;
  paid_at?: string;
  is_paid: boolean;
}

export interface Coupon {
  id: number;
  tenant_id: number;
  code: string;
  discount_percent: number;
  applies_to_shipping: boolean;
  is_active: boolean;
  usage_limit: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CouponInput {
  code: string;
  discount_percent: number;
  applies_to_shipping: boolean;
  is_active?: boolean;
  usage_limit?: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  code?: string;
  discount_percent?: number;
  applies_to_shipping?: boolean;
  discount_amount?: number;
  shipping_discount?: number;
  total_discount?: number;
  message?: string;
}

export interface WholesaleTier {
  min_quantity: number;
  discount_percent: number;
  label: string;
}
