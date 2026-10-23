export type AppRole = 'super_admin' | 'manager' | 'operator' | 'warehouse';
export type OrderStatus = 'new' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type DiscountType = 'percent' | 'fixed';
export type DiscountScope = 'all' | 'category' | 'product';

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  show_on_home: boolean;
  seo_title: string | null;
  seo_description: string | null;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/** Katalog kartasi uchun yengil mahsulot ko'rinishi */
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  rating_avg: number;
  rating_count: number;
  stock: number;
  track_stock: boolean;
  has_variants: boolean;
  category_id: string | null;
  is_new: boolean;
  is_bestseller: boolean;
  sold_count?: number;
  brand?: string | null;
}

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface Product extends ProductCard {
  short_description: string | null;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  weight_grams: number | null;
  attributes: ProductAttribute[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  color: string | null;
  color_hex: string | null;
  size: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
  sort_order: number;
}

export interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  button_text: string | null;
  link_url: string | null;
  placement: 'home_hero' | 'home_middle' | 'home_promo' | 'catalog_top' | 'sale_page';
  bg_color: string | null;
  text_color: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Promotion {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  discount_type: DiscountType;
  value: number;
  scope: DiscountScope;
  category_ids: string[];
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  value: number;
  max_discount: number | null;
  min_order_amount: number;
  scope: DiscountScope;
  category_ids: string[];
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  is_active: boolean;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  kind: 'courier' | 'pickup' | 'post';
  price: number;
  free_from: number | null;
  eta: string | null;
  requires_address: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  instructions: string | null;
  kind: 'cash' | 'card_on_delivery' | 'bank_transfer' | 'online';
  provider: 'click' | 'payme' | 'uzum' | null;
  is_active: boolean;
  sort_order: number;
}

export interface OrderAddress {
  region: string;
  city?: string | null;
  street: string;
  apartment?: string | null;
  landmark?: string | null;
}

export interface Order {
  id: string;
  number: number;
  user_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method_name: string;
  payment_provider: string | null;
  shipping_method_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address: OrderAddress | null;
  comment: string | null;
  subtotal: number;
  discount_total: number;
  coupon_code: string | null;
  shipping_cost: number;
  total: number;
  cost_total: number | null;
  items_count: number;
  tracking_number: string | null;
  admin_note: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  image_url: string | null;
  unit_price: number;
  original_price: number;
  cost_price: number | null;
  quantity: number;
  discount: number;
  line_total: number;
}

export interface OrderStatusHistory {
  id: number;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  full_name: string;
  phone: string;
  region: string;
  city: string | null;
  street: string;
  apartment: string | null;
  landmark: string | null;
  is_default: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string | null;
  rating: number;
  body: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
