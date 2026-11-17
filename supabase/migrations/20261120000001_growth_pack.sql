-- =====================================================================
-- 7 ta imkoniyat:
--  1) Click / Payme onlayn toʻlovi — tranzaksiyalar jadvali va “toʻlandi” funksiyasi
--  2) Tashlab ketilgan savat — eslatmalar va qaytgan xaridlar
--  3) “Kelganda xabar ber” — obunalar; qoldiq hodisalari (qayta keldi / kam qoldi / tugadi)
--  4) Tavsiyalar — “Birga olinadi” (birga sotib olingan mahsulotlar)
--  5) Ombor nazorati — qoldiq hodisalari triggeri (variantlar ham)
--  6) Hisobotlar — kategoriyalar, toʻlov usullari, mijozlar boʻyicha
--  7) Kargo — trek bosqichlari (orders.cargo_stage + cargo_events)
-- Idempotent: faqat yangi jadval/ustun/funksiya qoʻshiladi, mavjud maʼlumot oʻzgarmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261120000001"')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------------
-- 1) Onlayn toʻlov tranzaksiyalari (faqat server yozadi va oʻqiydi)
-- ---------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('click', 'payme')),
  ext_id text not null check (char_length(ext_id) between 1 and 100),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  -- 1 — yaratildi, 2 — toʻlandi, -1 — bekor (toʻlovdan oldin), -2 — bekor (toʻlovdan keyin)
  state integer not null default 1 check (state in (1, 2, -1, -2)),
  reason integer,
  create_time bigint not null,
  perform_time bigint not null default 0,
  cancel_time bigint not null default 0,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (provider, ext_id)
);
create index if not exists payment_transactions_order_idx on public.payment_transactions (order_id, created_at desc);
create index if not exists payment_transactions_time_idx on public.payment_transactions (provider, create_time);
alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from anon, authenticated;
grant all on public.payment_transactions to service_role;

-- Provayder toʻlovni tasdiqladi: buyurtma “toʻlandi”, yangi boʻlsa — “Tasdiqlandi”.
create or replace function public._online_payment_paid(p_order uuid, p_provider text, p_auto_confirm boolean default true)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v public.orders;
begin
  select * into v from public.orders where id = p_order for update;
  if not found or v.payment_status = 'paid' then return false; end if;
  update public.orders set payment_status = 'paid', payment_provider = p_provider, updated_at = now() where id = p_order;
  if p_auto_confirm and v.status = 'new' then
    update public.orders set status = 'confirmed', confirmed_at = now() where id = p_order;
    insert into public.order_status_history (order_id, status, note, changed_by)
    values (p_order, 'confirmed', initcap(p_provider) || ' orqali toʻlandi', null);
  end if;
  if v.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v.user_id, 'payment', 'Toʻlovingiz qabul qilindi',
      'Buyurtma №' || v.number || ' — ' || initcap(p_provider) || ' orqali toʻlandi', '/account/orders/' || v.id);
  end if;
  return true;
end;
$$;

-- Toʻlangan tranzaksiya provayder tomonidan bekor qilindi (pul qaytdi).
create or replace function public._online_payment_void(p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set payment_status = 'refunded', updated_at = now() where id = p_order and payment_status = 'paid';
  return found;
end;
$$;
revoke all on function public._online_payment_paid(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public._online_payment_void(uuid) from public, anon, authenticated;
grant execute on function public._online_payment_paid(uuid, text, boolean) to service_role;
grant execute on function public._online_payment_void(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 2) Tashlab ketilgan savat eslatmalari
-- ---------------------------------------------------------------------
create table if not exists public.cart_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cart_updated_at timestamptz not null,
  step smallint not null default 1 check (step between 1 and 3),
  items_count integer not null default 0,
  cart_total bigint not null default 0,
  coupon_id uuid references public.coupons (id) on delete set null,
  sent_at timestamptz not null default now(),
  recovered_order_id uuid references public.orders (id) on delete set null,
  recovered_at timestamptz,
  unique (user_id, cart_updated_at, step)
);
create index if not exists cart_reminders_sent_idx on public.cart_reminders (sent_at desc);
create index if not exists cart_reminders_coupon_idx on public.cart_reminders (coupon_id);
create index if not exists cart_reminders_order_idx on public.cart_reminders (recovered_order_id);
alter table public.cart_reminders enable row level security;
revoke all on public.cart_reminders from anon, authenticated;
grant all on public.cart_reminders to service_role;
-- Xodim (kuponlar ruxsati bilan) statistikani koʻradi
do $$ begin
  create policy cart_reminders_staff_read on public.cart_reminders for select to authenticated using (public.has_perm('coupons.write'));
exception when duplicate_object then null; end $$;
grant select on public.cart_reminders to authenticated;

-- Eslatmadan keyin 7 kun ichida berilgan buyurtma — “qaytgan xarid”
create or replace function public._cart_reminder_recovered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    update public.cart_reminders set recovered_order_id = new.id, recovered_at = now()
    where id = (
      select id from public.cart_reminders
      where user_id = new.user_id and recovered_order_id is null and sent_at > now() - interval '7 days'
      order by sent_at desc limit 1
    );
  end if;
  return null;
end;
$$;
revoke all on function public._cart_reminder_recovered() from public, anon, authenticated;
create or replace trigger cart_reminder_recovered after insert on public.orders
  for each row execute function public._cart_reminder_recovered();

-- ---------------------------------------------------------------------
-- 3) “Kelganda xabar ber” obunalari
-- ---------------------------------------------------------------------
create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique nulls not distinct (user_id, product_id, variant_id)
);
create index if not exists stock_alerts_product_idx on public.stock_alerts (product_id) where notified_at is null;
create index if not exists stock_alerts_variant_idx on public.stock_alerts (variant_id);
alter table public.stock_alerts enable row level security;
do $$ begin
  create policy stock_alerts_own_select on public.stock_alerts for select to authenticated
    using (user_id = auth.uid() or public.has_perm('inventory.write'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy stock_alerts_own_insert on public.stock_alerts for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy stock_alerts_own_update on public.stock_alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy stock_alerts_own_delete on public.stock_alerts for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
revoke all on public.stock_alerts from anon;
grant select, insert, update, delete on public.stock_alerts to authenticated;
grant all on public.stock_alerts to service_role;

-- ---------------------------------------------------------------------
-- 3 + 5) Qoldiq hodisalari: qayta keldi / kam qoldi / tugadi (fon ishi qayta ishlaydi)
-- ---------------------------------------------------------------------
create table if not exists public.stock_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('restock', 'low', 'out')),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  stock integer not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists stock_events_pending_idx on public.stock_events (created_at) where processed_at is null;
create index if not exists stock_events_product_idx on public.stock_events (product_id);
create index if not exists stock_events_variant_idx on public.stock_events (variant_id);
alter table public.stock_events enable row level security;
revoke all on public.stock_events from anon, authenticated;
grant all on public.stock_events to service_role;

create or replace function public._stock_event_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Variantli mahsulotlar variant triggeri orqali kuzatiladi (qayta kelish esa umumiy qoldiq bilan ham)
  if not new.track_stock then return null; end if;
  if old.stock <= 0 and new.stock > 0 then
    insert into public.stock_events (kind, product_id, stock) values ('restock', new.id, new.stock);
  elsif not new.has_variants and old.stock > 0 and new.stock <= 0 then
    insert into public.stock_events (kind, product_id, stock) values ('out', new.id, new.stock);
  elsif not new.has_variants and old.stock > new.low_stock_threshold and new.stock <= new.low_stock_threshold then
    insert into public.stock_events (kind, product_id, stock) values ('low', new.id, new.stock);
  end if;
  return null;
end;
$$;
revoke all on function public._stock_event_product() from public, anon, authenticated;
create or replace trigger stock_event_product after update of stock on public.products
  for each row when (old.stock is distinct from new.stock) execute function public._stock_event_product();

create or replace function public._stock_event_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_thr integer; v_track boolean;
begin
  select low_stock_threshold, track_stock into v_thr, v_track from public.products where id = new.product_id;
  if not coalesce(v_track, false) or not new.is_active then return null; end if;
  if old.stock <= 0 and new.stock > 0 then
    insert into public.stock_events (kind, product_id, variant_id, stock) values ('restock', new.product_id, new.id, new.stock);
  elsif old.stock > 0 and new.stock <= 0 then
    insert into public.stock_events (kind, product_id, variant_id, stock) values ('out', new.product_id, new.id, new.stock);
  elsif old.stock > v_thr and new.stock <= v_thr then
    insert into public.stock_events (kind, product_id, variant_id, stock) values ('low', new.product_id, new.id, new.stock);
  end if;
  return null;
end;
$$;
revoke all on function public._stock_event_variant() from public, anon, authenticated;
create or replace trigger stock_event_variant after update of stock on public.product_variants
  for each row when (old.stock is distinct from new.stock) execute function public._stock_event_variant();

-- ---------------------------------------------------------------------
-- 4) “Birga olinadi”: shu mahsulot(lar) bilan bitta buyurtmada koʻp olingan faol mahsulotlar
-- ---------------------------------------------------------------------
create or replace function public.bought_together(p_ids uuid[], p_limit integer default 8)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.product_id order by x.cnt desc, x.product_id), '{}'::uuid[]) from (
    select oi2.product_id, count(distinct oi2.order_id) as cnt
    from public.order_items oi1
    join public.orders o on o.id = oi1.order_id and o.status not in ('cancelled', 'returned')
    join public.order_items oi2 on oi2.order_id = oi1.order_id and oi2.product_id is not null
    join public.products p on p.id = oi2.product_id and p.is_active
    where oi1.product_id = any (p_ids) and not (oi2.product_id = any (p_ids))
      and o.created_at > now() - interval '365 days'
    group by oi2.product_id
    order by count(distinct oi2.order_id) desc
    limit least(greatest(coalesce(p_limit, 8), 1), 24)
  ) x;
$$;
revoke all on function public.bought_together(uuid[], integer) from public;
grant execute on function public.bought_together(uuid[], integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) Qoʻshimcha hisobotlar
-- ---------------------------------------------------------------------
create or replace function public.report_categories(p_from date, p_to date)
returns table (category_id uuid, category_name text, quantity bigint, revenue bigint, gross_profit bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('reports.view') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select c.id, coalesce(max(c.name), 'Kategoriyasiz'),
    sum(oi.quantity)::bigint, sum(oi.line_total)::bigint,
    sum(oi.line_total - oi.cost_price * oi.quantity) filter (where oi.cost_price is not null)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  left join public.categories c on c.id = p.category_id
  where o.status not in ('cancelled', 'returned')
    and (o.created_at at time zone 'Asia/Tashkent')::date between p_from and p_to
  group by c.id
  order by sum(oi.line_total) desc;
end;
$$;

create or replace function public.report_payments(p_from date, p_to date)
returns table (payment_method_name text, orders_count bigint, amount bigint, paid_amount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('reports.view') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select o.payment_method_name, count(*)::bigint, coalesce(sum(o.total), 0)::bigint,
    coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0)::bigint
  from public.orders o
  where o.status not in ('cancelled', 'returned')
    and (o.created_at at time zone 'Asia/Tashkent')::date between p_from and p_to
  group by o.payment_method_name
  order by sum(o.total) desc;
end;
$$;

create or replace function public.report_customers(p_from date, p_to date, p_limit integer default 20)
returns table (user_id uuid, customer_name text, customer_phone text, orders_count bigint, amount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('reports.view') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select max(o.user_id::text)::uuid, max(o.customer_name), o.customer_phone, count(*)::bigint, coalesce(sum(o.total), 0)::bigint
  from public.orders o
  where o.status not in ('cancelled', 'returned')
    and (o.created_at at time zone 'Asia/Tashkent')::date between p_from and p_to
  group by o.customer_phone
  order by sum(o.total) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
end;
$$;
revoke all on function public.report_categories(date, date) from public, anon;
revoke all on function public.report_payments(date, date) from public, anon;
revoke all on function public.report_customers(date, date, integer) from public, anon;
grant execute on function public.report_categories(date, date) to authenticated, service_role;
grant execute on function public.report_payments(date, date) to authenticated, service_role;
grant execute on function public.report_customers(date, date, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) Kargo bosqichlari
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists cargo_stage text check (cargo_stage is null or cargo_stage ~ '^[a-z0-9_]{1,30}$');
create index if not exists orders_tracking_idx on public.orders (lower(tracking_number)) where tracking_number is not null;

create table if not exists public.cargo_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  stage text not null check (stage ~ '^[a-z0-9_]{1,30}$'),
  note text check (char_length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cargo_events_order_idx on public.cargo_events (order_id, created_at);
create index if not exists cargo_events_created_by_idx on public.cargo_events (created_by);
alter table public.cargo_events enable row level security;
do $$ begin
  create policy cargo_events_staff_read on public.cargo_events for select to authenticated using (public.has_perm('orders.read'));
exception when duplicate_object then null; end $$;
revoke all on public.cargo_events from anon;
grant select on public.cargo_events to authenticated;
grant all on public.cargo_events to service_role;

-- Xodim: bir yoki bir nechta buyurtma (id yoki trek raqami boʻyicha) bosqichini yangilaydi.
create or replace function public.admin_cargo_update(p_order_ids uuid[], p_tracks text[], p_stage text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_missing text[];
  v_note text := left(nullif(trim(coalesce(p_note, '')), ''), 300);
begin
  if not public.has_perm('orders.write') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_stage is null or p_stage !~ '^[a-z0-9_]{1,30}$' then raise exception 'BAD_STAGE' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct o.id), '{}') into v_ids from public.orders o
  where (o.id = any (coalesce(p_order_ids, '{}'))
      or lower(o.tracking_number) = any (select lower(trim(t)) from unnest(coalesce(p_tracks, '{}')) t where trim(t) <> ''))
    and o.status not in ('cancelled', 'returned');
  select coalesce(array_agg(t), '{}') into v_missing from (
    select distinct trim(t) as t from unnest(coalesce(p_tracks, '{}')) t
    where trim(t) <> '' and not exists (select 1 from public.orders o where lower(o.tracking_number) = lower(trim(t)))
  ) m;
  if array_length(v_ids, 1) > 500 then raise exception 'TOO_MANY' using errcode = 'P0001'; end if;
  update public.orders set cargo_stage = p_stage, updated_at = now() where id = any (v_ids);
  insert into public.cargo_events (order_id, stage, note, created_by)
  select unnest(v_ids), p_stage, v_note, auth.uid();
  return jsonb_build_object(
    'updated', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number, 'status', o.status, 'user_id', o.user_id))
                         from public.orders o where o.id = any (v_ids)), '[]'::jsonb),
    'missing', to_jsonb(v_missing));
end;
$$;
revoke all on function public.admin_cargo_update(uuid[], text[], text, text) from public, anon;
grant execute on function public.admin_cargo_update(uuid[], text[], text, text) to authenticated, service_role;

-- Trek raqami boʻyicha kuzatish (shaxsiy maʼlumotsiz: faqat bosqichlar va holat).
create or replace function public.track_cargo(p_track text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'tracking_number', o.tracking_number, 'cargo_stage', o.cargo_stage,
    'created_at', o.created_at, 'shipped_at', o.shipped_at, 'arrived_at', o.arrived_at, 'delivered_at', o.delivered_at,
    'cargo', coalesce((select jsonb_agg(jsonb_build_object('stage', e.stage, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
                       from public.cargo_events e where e.order_id = o.id), '[]'::jsonb))
  from public.orders o
  where p_track is not null and char_length(trim(p_track)) between 4 and 80
    and lower(o.tracking_number) = lower(trim(p_track))
  order by o.created_at desc
  limit 1;
$$;
revoke all on function public.track_cargo(text) from public;
grant execute on function public.track_cargo(text) to anon, authenticated, service_role;

-- Raqam + telefon bilan kuzatishda ham kargo bosqichlari
create or replace function public.track_order(p_number bigint, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where number = p_number and customer_phone = p_phone;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'number', v_order.number, 'status', v_order.status, 'total', v_order.total, 'items_count', v_order.items_count,
    'shipping_method_name', v_order.shipping_method_name, 'tracking_number', v_order.tracking_number,
    'created_at', v_order.created_at, 'cargo_stage', v_order.cargo_stage,
    'cargo', coalesce((select jsonb_agg(jsonb_build_object('stage', e.stage, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
                       from public.cargo_events e where e.order_id = v_order.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'created_at', h.created_at) order by h.created_at)
      from public.order_status_history h where h.order_id = v_order.id), '[]'::jsonb)
  );
end;
$$;

-- Mijozga koʻrinadigan buyurtma maʼlumotiga kargo bosqichlari qoʻshiladi
create or replace function public._order_public_json(p_order public.orders)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_order.id, 'number', p_order.number, 'status', p_order.status, 'payment_status', p_order.payment_status,
    'payment_method_name', p_order.payment_method_name, 'shipping_method_name', p_order.shipping_method_name,
    'shipping_method_id', p_order.shipping_method_id,
    'customer_name', p_order.customer_name, 'customer_phone', p_order.customer_phone, 'customer_email', p_order.customer_email,
    'address', p_order.address, 'comment', p_order.comment, 'subtotal', p_order.subtotal,
    'discount_total', p_order.discount_total, 'coupon_code', p_order.coupon_code, 'shipping_cost', p_order.shipping_cost,
    'total', p_order.total, 'items_count', p_order.items_count, 'tracking_number', p_order.tracking_number,
    'cancelled_reason', p_order.cancelled_reason, 'created_at', p_order.created_at, 'confirmed_at', p_order.confirmed_at,
    'shipped_at', p_order.shipped_at, 'arrived_at', p_order.arrived_at, 'delivered_at', p_order.delivered_at,
    'cancelled_at', p_order.cancelled_at,
    'fulfillment', p_order.fulfillment, 'fulfillment_status', p_order.fulfillment_status, 'delivery_fee', p_order.delivery_fee,
    'cargo_stage', p_order.cargo_stage,
    'cargo', coalesce((select jsonb_agg(jsonb_build_object('stage', e.stage, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
                       from public.cargo_events e where e.order_id = p_order.id), '[]'::jsonb),
    'pickup', (select jsonb_build_object('name', sm.name, 'address', coalesce(sm.pickup_address, sm.description), 'map_url', sm.map_url, 'hours', sm.work_hours)
               from public.shipping_methods sm where sm.id = p_order.shipping_method_id and p_order.fulfillment = 'pickup'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id, 'product_id', oi.product_id, 'variant_id', oi.variant_id, 'product_name', oi.product_name,
        'variant_name', oi.variant_name, 'sku', oi.sku, 'image_url', oi.image_url, 'unit_price', oi.unit_price,
        'original_price', oi.original_price, 'quantity', oi.quantity, 'discount', oi.discount, 'line_total', oi.line_total,
        'slug', pr.slug
      ) order by oi.product_name)
      from public.order_items oi left join public.products pr on pr.id = oi.product_id
      where oi.order_id = p_order.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'note', h.note, 'created_at', h.created_at) order by h.created_at)
      from public.order_status_history h where h.order_id = p_order.id), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- Fon ishlari: har 10 daqiqada sayt /api/cron/jobs ga murojaat qiladi (pg_cron + pg_net).
-- Kalit app_meta 'jobs_key' da (bir marta yaratiladi), soʻrov sarlavhasida yuboriladi.
-- ---------------------------------------------------------------------
insert into public.app_meta (key, value)
values ('jobs_key', to_jsonb(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
on conflict (key) do nothing;
insert into public.app_meta (key, value)
values ('jobs_url', '"https://dokon2.vercel.app/api/cron/jobs"')
on conflict (key) do nothing;

-- pg_cron va pg_net boʻlsa (Supabase’da bor) — jadval yaratiladi; oddiy Postgres (testlar) da oʻtkazib yuboriladi.
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    -- Har 10 daqiqada (manzil va kalit app_meta dan oʻqiladi — matnda sir yoʻq)
    perform cron.schedule('dokon-jobs', '*/10 * * * *', $job$
      select net.http_get(
        url := (select value #>> '{}' from public.app_meta where key = 'jobs_url'),
        headers := jsonb_build_object('x-jobs-key', (select value #>> '{}' from public.app_meta where key = 'jobs_key')),
        timeout_milliseconds := 60000
      );
    $job$);
  end if;
end
$do$;
