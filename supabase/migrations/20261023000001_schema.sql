-- =====================================================================
-- Do'kon: asosiy sxema (jadvallar, enumlar, indekslar)
-- Bu migratsiya faqat yangi obyektlarni yaratadi va mavjud jadvallarni o'chirmaydi.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------- Enumlar ----------
do $$ begin
  create type public.app_role as enum ('super_admin', 'manager', 'operator', 'warehouse');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_scope as enum ('all', 'category', 'product');
exception when duplicate_object then null; end $$;

-- ---------- Foydalanuvchilar va rollar ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 20),
  email text,
  avatar_url text,
  is_blocked boolean not null default false,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists profiles_created_idx on public.profiles (created_at desc);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);

-- ---------- Katalog ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  show_on_home boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_not_self_parent check (parent_id is null or parent_id <> id)
);
create index if not exists categories_parent_idx on public.categories (parent_id, sort_order);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  brand text,
  sku text unique,
  barcode text,
  price bigint not null check (price >= 0),
  compare_at_price bigint check (compare_at_price is null or compare_at_price >= 0),
  cost_price bigint check (cost_price is null or cost_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  track_stock boolean not null default true,
  has_variants boolean not null default false,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_bestseller boolean not null default false,
  is_new boolean not null default false,
  image_url text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  sold_count integer not null default 0,
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  attributes jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id) where is_active;
create index if not exists products_active_created_idx on public.products (is_active, created_at desc);
create index if not exists products_price_idx on public.products (price);
create index if not exists products_sold_idx on public.products (sold_count desc);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_sku_trgm_idx on public.products using gin (sku extensions.gin_trgm_ops);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  storage_path text,
  alt text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);
create unique index if not exists product_images_one_primary on public.product_images (product_id) where is_primary;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sku text unique,
  color text,
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$'),
  size text,
  price bigint check (price is null or price >= 0),
  compare_at_price bigint check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, sort_order);
create index if not exists product_variants_color_idx on public.product_variants (lower(color));
create index if not exists product_variants_size_idx on public.product_variants (lower(size));

-- Ombor harakatlari jurnali (inventory)
create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  delta integer not null,
  stock_after integer,
  reason text not null check (reason in ('order', 'cancel', 'return', 'manual', 'import', 'initial')),
  order_id uuid,
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ---------- Savatcha, manzillar, sevimlilar ----------
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 999),
  added_at timestamptz not null default now(),
  unique nulls not distinct (cart_id, product_id, variant_id)
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 40),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text not null check (char_length(phone) <= 20),
  region text not null check (char_length(region) <= 80),
  city text check (char_length(city) <= 80),
  street text not null check (char_length(street) <= 200),
  apartment text check (char_length(apartment) <= 60),
  landmark text check (char_length(landmark) <= 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);

create table if not exists public.wishlists (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------- Yetkazib berish va to'lov ----------
create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind text not null default 'courier' check (kind in ('courier', 'pickup', 'post')),
  price bigint not null default 0 check (price >= 0),
  free_from bigint check (free_from is null or free_from >= 0),
  eta text,
  requires_address boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  instructions text,
  kind text not null default 'cash' check (kind in ('cash', 'card_on_delivery', 'bank_transfer', 'online')),
  provider text check (provider is null or provider in ('click', 'payme', 'uzum')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Chegirmalar ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  discount_type public.discount_type not null default 'percent',
  value bigint not null check (value > 0),
  max_discount bigint check (max_discount is null or max_discount > 0),
  min_order_amount bigint not null default 0 check (min_order_amount >= 0),
  scope public.discount_scope not null default 'all',
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (discount_type <> 'percent' or value <= 100),
  constraint coupons_dates check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text,
  discount_type public.discount_type not null default 'percent',
  value bigint not null check (value > 0),
  scope public.discount_scope not null default 'all',
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_percent_range check (discount_type <> 'percent' or value <= 100),
  constraint promotions_dates check (starts_at is null or ends_at is null or starts_at < ends_at)
);

-- ---------- Buyurtmalar ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated by default as identity (start with 100001) unique,
  user_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'new',
  payment_status public.payment_status not null default 'pending',
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  payment_method_name text not null,
  payment_provider text,
  shipping_method_id uuid references public.shipping_methods (id) on delete set null,
  shipping_method_name text not null,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) <= 20),
  customer_email text,
  address jsonb,
  comment text check (char_length(comment) <= 1000),
  subtotal bigint not null check (subtotal >= 0),
  discount_total bigint not null default 0 check (discount_total >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  shipping_cost bigint not null default 0 check (shipping_cost >= 0),
  total bigint not null check (total >= 0),
  cost_total bigint,
  items_count integer not null default 0,
  tracking_number text,
  admin_note text,
  cancelled_reason text,
  idempotency_key text not null unique,
  public_token uuid not null default gen_random_uuid(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  stock_restored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (customer_phone);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text,
  sku text,
  image_url text,
  unit_price bigint not null check (unit_price >= 0),
  original_price bigint not null check (original_price >= 0),
  cost_price bigint,
  quantity integer not null check (quantity > 0),
  discount bigint not null default 0 check (discount >= 0),
  line_total bigint not null check (line_total >= 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  phone text,
  amount bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id, user_id);

-- ---------- Kontent ----------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text not null,
  mobile_image_url text,
  button_text text,
  link_url text,
  placement text not null default 'home_hero'
    check (placement in ('home_hero', 'home_middle', 'home_promo', 'catalog_top', 'sale_page')),
  bg_color text check (bg_color is null or bg_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color text check (text_color is null or text_color ~ '^#[0-9a-fA-F]{6}$'),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banners_placement_idx on public.banners (placement, sort_order);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  content text not null default '',
  seo_title text,
  seo_description text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);

-- user_id null bo'lsa xodimlar uchun bildirishnoma
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
