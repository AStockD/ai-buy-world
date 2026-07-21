// ============================================================
// AIBuyWorld 共享类型定义
// ============================================================

// ─── 用户 ───
export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar_url?: string;
  google_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── 地址 ───
export interface UserAddress {
  id: string;
  user_id: string;
  receiver_name: string;
  phone: string;
  country_code: string;
  postal_code?: string;
  admin_area1: string;
  admin_area2?: string;
  admin_area3?: string;
  address_line: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
  willing_to_receive_for_others: boolean;
  created_at: string;
  updated_at: string;
}

// ─── 商品 ───
export interface Product {
  id: string;
  source_platform: string;
  source_product_id: string;
  source_url: string;
  title: string;
  description?: string;
  images: string[];
  source_price: number;
  source_currency: string;
  weight_kg?: number;
  sku_variants?: SkuVariants;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface SkuVariants {
  dimensions: string[];
  skus: SkuItem[];
}

export interface SkuItem {
  sku_id: string;
  specs: Record<string, string>;
  price_delta: number;
  stock: number;
  weight_kg?: number;
  image_url?: string;
}

// ─── 定价 ───
export interface ProductPricing {
  id: string;
  product_id: string;
  region: string;
  source_price: number;
  exchange_rate_snapshot: number;
  local_price: number;
  shipping_category: '普通' | '大件' | '精品易碎' | '不可邮';
  shipping_fee: number;
  status: '生效' | '过期';
  exchange_rate_updated_at: string;
}

// ─── 订单 ───
export type OrderStatus = '待支付' | '已支付' | '集货中' | '运输中' | '待提货' | '已提货';

export interface Order {
  id: string;
  user_id: string;
  product_id: string;
  address_id: string;
  delivery_batch_id?: string;
  flylink_order_id?: string;
  status: OrderStatus;
  quantity: number;
  sku_specs: Record<string, string>;
  unit_price: number;
  total_price: number;
  shipping_fee: number;
  receiver_discount: number;
  shipping_discount_applied: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── 批次 ───
export type BatchStatus = '集货中' | '已截止' | '运输中' | '已到达' | '已完成';

export interface DeliveryBatch {
  id: string;
  area: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_address: Record<string, string>;
  lat?: number;
  lng?: number;
  status: BatchStatus;
  order_deadline: string;
  ship_date: string;
  estimated_arrival: string;
  current_orders: number;
  current_value: number;
  created_at: string;
}

// ─── 心愿单 ───
export type WishlistStatus = '待购' | '已购' | '已过期';

export interface Wishlist {
  id: string;
  user_id: string;
  product_id: string;
  status: WishlistStatus;
  target_price?: number;
  created_at: string;
  updated_at: string;
}

// ─── 对话 ───
export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  card_type?: string;
  card_data?: Record<string, unknown>;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface ToolCall {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
}

// ─── SSE 事件 ───
export type SSEEvent =
  | { event: 'text_delta'; data: { text: string } }
  | { event: 'text_done'; data: { full_text: string } }
  | { event: 'card'; data: { card_type: string; card_data: Record<string, unknown> } }
  | { event: 'tool_call'; data: { tool_name: string; arguments: Record<string, unknown> } }
  | { event: 'tool_result'; data: { tool_name: string; result: unknown } }
  | { event: 'parse_step'; data: { step: 1 | 2 | 3 | 4 | 5; label: string; status: 'done' | 'running' | 'pending' } }
  | { event: 'order_update'; data: { orderId: string; status: OrderStatus } }
  | { event: 'notification'; data: { type: string; message: string } }
  | { event: 'done'; data: { message_id: string } }
  | { event: 'error'; data: { code: string; message: string } };

// ─── 卡片类型 ───
export type CardType =
  | 'product_card'
  | 'order_card'
  | 'payment_card'
  | 'wishlist_card'
  | 'recommendation_card'
  | 'shipping_card'
  | 'address_card'
  | 'batch_card'
  | 'flylink_processing_card'
  | 'willing_card'
  | 'success_card';

// ─── 通知 ───
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// ─── API 通用 ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  page_size: number;
}
