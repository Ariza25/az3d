export interface TenantCarrierAccount {
  id: number;
  tenant_id: number;
  provider: string;
  account_name: string;
  auth_type: string;
  origin_cep?: string;
  token_expires_at?: string;
  is_active: boolean;
  is_connected: boolean;
  sync_tracking: boolean;
  last_sync_at?: string;
  last_error?: string;
  settings?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface TenantCarrierAccountInput {
  provider: string;
  account_name?: string;
  auth_type?: string;
  origin_cep?: string;
  is_active: boolean;
  sync_tracking: boolean;
  credentials?: Record<string, unknown>;
}

export interface ShipmentEvent {
  id: number;
  tenant_id: number;
  shipment_id: number;
  order_id: number;
  carrier: string;
  event_code?: string;
  description: string;
  location?: string;
  occurred_at: string;
  created_at: string;
}

export interface OrderShipment {
  id: number;
  tenant_id: number;
  order_id: number;
  order?: any;
  carrier: string;
  tracking_code: string;
  status: string;
  posted_at?: string;
  delivered_at?: string;
  last_sync_at?: string;
  last_error?: string;
  events?: ShipmentEvent[];
  created_at: string;
  updated_at: string;
}

export interface OrderShipmentInput {
  order_id: number;
  carrier?: string;
  tracking_code: string;
  status?: string;
}

export interface CarrierHealthItem {
  provider: string;
  account_name: string;
  is_active: boolean;
  is_connected: boolean;
  sync_tracking: boolean;
  active_shipments: number;
  last_sync_at?: string;
  last_error?: string;
}

export interface TrackingSyncEntry {
  shipment_id: number;
  order_id: number;
  carrier: string;
  tracking_code: string;
  status: string;
  events_created: number;
  error?: string;
}

export interface TrackingSyncSummary {
  processed: number;
  synced: number;
  failed: number;
  results: TrackingSyncEntry[];
}
