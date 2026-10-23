-- =====================================================================
-- Do'kon: yordamchi funksiyalar, triggerlar va biznes-logika
-- Barcha SECURITY DEFINER funksiyalarda search_path = '' qilingan.
-- =====================================================================

-- ---------- Ruxsatlar matritsasi ----------
insert into public.role_permissions (role, permission)
select r.role::public.app_role, p.permission
from (values
  ('super_admin', array[
    'dashboard.view', 'products.read', 'products.write', 'products.delete', 'inventory.write',
    'categories.write', 'orders.read', 'orders.write', 'orders.fulfill', 'orders.cancel',
    'customers.read', 'customers.block', 'banners.write', 'promotions.write', 'coupons.write',
    'pages.write', 'settings.write', 'payments.write', 'reports.view', 'staff.manage',
    'audit.view', 'reviews.moderate', 'media.write']),
  ('manager', array[
    'dashboard.view', 'products.read', 'products.write', 'products.delete', 'inventory.write',
    'categories.write', 'orders.read', 'orders.write', 'orders.fulfill', 'orders.cancel',
    'customers.read', 'customers.block', 'banners.write', 'promotions.write', 'coupons.write',
    'pages.write', 'settings.write', 'payments.write', 'reports.view', 'audit.view',
    'reviews.moderate', 'media.write']),
  ('operator', array[
    'dashboard.view', 'products.read', 'orders.read', 'orders.write', 'orders.fulfill',
    'orders.cancel', 'customers.read', 'reviews.moderate']),
  ('warehouse', array[
    'dashboard.view', 'products.read', 'inventory.write', 'orders.read', 'orders.fulfill'])
) as r (role, perms)
cross join lateral unnest(r.perms) as p (permission)
on conflict do nothing;

create or replace function public.has_perm(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = auth.uid() and rp.permission = p_permission
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct rp.permission order by rp.permission), '{}')
  from public.user_roles ur
  join public.role_permissions rp on rp.role = ur.role
  where ur.user_id = auth.uid();
$$;

create or replace function public.my_roles()
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(role order by role), '{}') from public.user_roles where user_id = auth.uid();
$$;

-- Ishonchli chaqiruvchi: service role (server) yoki to'g'ridan-to'g'ri DB ulanishi (SQL Editor).
-- anon/authenticated JWT bilan PostgREST orqali kelgan so'rovlar ishonchsiz.
create or replace function public._is_trusted_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'postgres') in ('service_role', 'postgres');
$$;

-- ---------- Umumiy triggerlar ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'categories', 'products', 'product_variants', 'shipping_methods',
    'payment_methods', 'coupons', 'promotions', 'orders', 'banners', 'pages', 'site_settings']
  loop
    execute format('create or replace trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Yangi foydalanuvchi uchun profil. Rollar HECH QACHON bu yerda berilmaydi.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    left(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 20),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mijoz o'z profilida bloklash maydonlarini o'zgartira olmaydi
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.is_blocked is distinct from old.is_blocked or new.blocked_reason is distinct from old.blocked_reason)
     and not public.has_perm('customers.block') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if auth.uid() is not null and new.email is distinct from old.email and not public.has_perm('customers.block') then
    new.email := old.email;
  end if;
  return new;
end;
$$;

create or replace trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Mahsulot asosiy rasmini products.image_url ga sinxronlash
create or replace function public.sync_product_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set image_url = (
    select i.url from public.product_images i
    where i.product_id = v_product
    order by i.is_primary desc, i.sort_order, i.created_at
    limit 1
  )
  where p.id = v_product;
  return null;
end;
$$;

create or replace trigger sync_product_image after insert or update or delete on public.product_images
  for each row execute function public.sync_product_image();

-- Variantli mahsulotda umumiy qoldiq = faol variantlar qoldig'i yig'indisi
create or replace function public.sync_variant_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set stock = coalesce((
    select sum(v.stock) from public.product_variants v where v.product_id = v_product and v.is_active
  ), 0)
  where p.id = v_product and p.has_variants;
  return null;
end;
$$;

create or replace trigger sync_variant_stock after insert or update or delete on public.product_variants
  for each row execute function public.sync_variant_stock();

-- Reyting
create or replace function public.sync_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = v_product and r.is_approved), 0),
      rating_count = (select count(*) from public.reviews r where r.product_id = v_product and r.is_approved)
  where p.id = v_product;
  return null;
end;
$$;

create or replace trigger sync_product_rating after insert or update or delete on public.reviews
  for each row execute function public.sync_product_rating();

-- ---------- Audit log ----------
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_changes_old jsonb := '{}'::jsonb;
  v_changes_new jsonb := '{}'::jsonb;
  v_key text;
  v_ignored text[] := array['updated_at', 'stock', 'sold_count', 'rating_avg', 'rating_count', 'image_url', 'used_count'];
begin
  -- Tizim (service role) amallari, masalan checkout, bu yerda yozilmaydi: ular o'z jurnallariga ega.
  if v_actor is null then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for v_key in select jsonb_object_keys(v_new) loop
      if not (v_key = any (v_ignored)) and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes_old := v_changes_old || jsonb_build_object(v_key, v_old -> v_key);
        v_changes_new := v_changes_new || jsonb_build_object(v_key, v_new -> v_key);
      end if;
    end loop;
    if v_changes_new = '{}'::jsonb then
      return null;
    end if;
    v_old := v_changes_old;
    v_new := v_changes_new;
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old);
  end if;

  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, old_data, new_data)
  values (
    v_actor,
    (select email from public.profiles where id = v_actor),
    lower(tg_op),
    tg_table_name,
    coalesce(
      to_jsonb(coalesce(new, old)) ->> 'id',
      to_jsonb(coalesce(new, old)) ->> 'key',
      to_jsonb(coalesce(new, old)) ->> 'user_id'
    ),
    v_old,
    v_new
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['products', 'product_variants', 'categories', 'coupons', 'promotions', 'banners',
    'pages', 'site_settings', 'payment_methods', 'shipping_methods', 'user_roles', 'orders', 'reviews']
  loop
    execute format('create or replace trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- Profilda faqat bloklash o'zgarishlarini audit qilamiz
create or replace function public.audit_profile_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.is_blocked is distinct from old.is_blocked then
    insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, old_data, new_data)
    values (auth.uid(), (select email from public.profiles where id = auth.uid()),
      case when new.is_blocked then 'block' else 'unblock' end, 'profiles', new.id::text,
      jsonb_build_object('is_blocked', old.is_blocked),
      jsonb_build_object('is_blocked', new.is_blocked, 'reason', new.blocked_reason));
  end if;
  return null;
end;
$$;

create or replace trigger audit_profile_block after update on public.profiles
  for each row execute function public.audit_profile_block();

-- ---------- Rate limit (login, checkout va boshqalar) ----------
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public._is_trusted_caller() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning count into v_count;

  -- Eski yozuvlarni vaqti-vaqti bilan tozalash
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

-- ---------- Buyurtma yaratish (faqat server, service role orqali) ----------
-- Narxlar serverda (Next.js) bazadagi joriy ma'lumotlardan hisoblanadi va shu funksiyaga uzatiladi.
-- Funksiya qoldiqni atomar kamaytiradi, kupon limitlarini tekshiradi va dublikatdan himoya qiladi.
create or replace function public.place_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.orders;
  v_order public.orders;
  v_item jsonb;
  v_user uuid := nullif(p ->> 'user_id', '')::uuid;
  v_coupon uuid := nullif(p ->> 'coupon_id', '')::uuid;
  v_qty integer;
  v_stock integer;
  v_product public.products;
  v_used integer;
  v_limit integer;
begin
  if not public._is_trusted_caller() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_existing from public.orders where idempotency_key = p ->> 'idempotency_key';
  if found then
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'token', v_existing.public_token, 'duplicate', true);
  end if;

  if v_user is not null and exists (select 1 from public.profiles where id = v_user and is_blocked) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  begin
    insert into public.orders (
      user_id, payment_method_id, payment_method_name, payment_provider, shipping_method_id, shipping_method_name,
      customer_name, customer_phone, customer_email, address, comment,
      subtotal, discount_total, coupon_id, coupon_code, shipping_cost, total, cost_total, items_count,
      idempotency_key
    ) values (
      v_user,
      nullif(p ->> 'payment_method_id', '')::uuid, p ->> 'payment_method_name', nullif(p ->> 'payment_provider', ''),
      nullif(p ->> 'shipping_method_id', '')::uuid, p ->> 'shipping_method_name',
      p ->> 'customer_name', p ->> 'customer_phone', nullif(p ->> 'customer_email', ''), p -> 'address', nullif(p ->> 'comment', ''),
      (p ->> 'subtotal')::bigint, (p ->> 'discount_total')::bigint, v_coupon, nullif(p ->> 'coupon_code', ''),
      (p ->> 'shipping_cost')::bigint, (p ->> 'total')::bigint, nullif(p ->> 'cost_total', '')::bigint,
      (select coalesce(sum((i ->> 'quantity')::integer), 0) from jsonb_array_elements(p -> 'items') i),
      p ->> 'idempotency_key'
    ) returning * into v_order;
  exception when unique_violation then
    select * into v_existing from public.orders where idempotency_key = p ->> 'idempotency_key';
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'token', v_existing.public_token, 'duplicate', true);
  end;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;

    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid and is_active for update;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_item ->> 'product_name' using errcode = 'P0001';
    end if;

    if nullif(v_item ->> 'variant_id', '') is not null then
      update public.product_variants
      set stock = stock - v_qty
      where id = (v_item ->> 'variant_id')::uuid and product_id = v_product.id and is_active and stock >= v_qty
      returning stock into v_stock;
      if not found then
        raise exception 'OUT_OF_STOCK:%', v_item ->> 'product_name' using errcode = 'P0001';
      end if;
      update public.products set sold_count = sold_count + v_qty where id = v_product.id;
    elsif v_product.track_stock then
      update public.products
      set stock = stock - v_qty, sold_count = sold_count + v_qty
      where id = v_product.id and stock >= v_qty
      returning stock into v_stock;
      if not found then
        raise exception 'OUT_OF_STOCK:%', v_item ->> 'product_name' using errcode = 'P0001';
      end if;
    else
      update public.products set sold_count = sold_count + v_qty where id = v_product.id;
      v_stock := null;
    end if;

    if v_stock is not null then
      insert into public.inventory_movements (product_id, variant_id, delta, stock_after, reason, order_id, created_by)
      values (v_product.id, nullif(v_item ->> 'variant_id', '')::uuid, -v_qty, v_stock, 'order', v_order.id, null);

      if v_stock <= v_product.low_stock_threshold then
        insert into public.notifications (user_id, type, title, body, link)
        values (null, 'low_stock', 'Qoldiq kam: ' || v_product.name,
          'Omborda ' || v_stock || ' dona qoldi', '/admin/products/' || v_product.id);
      end if;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku, image_url,
      unit_price, original_price, cost_price, quantity, discount, line_total
    ) values (
      v_order.id, v_product.id, nullif(v_item ->> 'variant_id', '')::uuid, v_item ->> 'product_name',
      nullif(v_item ->> 'variant_name', ''), nullif(v_item ->> 'sku', ''), nullif(v_item ->> 'image_url', ''),
      (v_item ->> 'unit_price')::bigint, (v_item ->> 'original_price')::bigint, nullif(v_item ->> 'cost_price', '')::bigint,
      v_qty, coalesce((v_item ->> 'discount')::bigint, 0), (v_item ->> 'line_total')::bigint
    );
  end loop;

  if v_coupon is not null then
    select per_user_limit into v_limit from public.coupons where id = v_coupon;
    if v_limit is not null then
      select count(*) into v_used from public.coupon_redemptions r
      where r.coupon_id = v_coupon
        and ((v_user is not null and r.user_id = v_user) or r.phone = p ->> 'customer_phone');
      if v_used >= v_limit then
        raise exception 'COUPON_USER_LIMIT' using errcode = 'P0001';
      end if;
    end if;

    update public.coupons
    set used_count = used_count + 1
    where id = v_coupon and is_active
      and (usage_limit is null or used_count < usage_limit)
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now());
    if not found then
      raise exception 'COUPON_INVALID' using errcode = 'P0001';
    end if;

    insert into public.coupon_redemptions (coupon_id, order_id, user_id, phone, amount)
    values (v_coupon, v_order.id, v_user, p ->> 'customer_phone', (p ->> 'discount_total')::bigint);
  end if;

  insert into public.order_status_history (order_id, status, note) values (v_order.id, 'new', 'Buyurtma qabul qilindi');
  insert into public.notifications (user_id, type, title, body, link)
  values (null, 'new_order', 'Yangi buyurtma #' || v_order.number,
    v_order.customer_name || ' — ' || v_order.total || ' so''m', '/admin/orders/' || v_order.id);

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'token', v_order.public_token, 'duplicate', false);
end;
$$;

-- Bekor qilish/qaytarishda qoldiqni tiklash (ichki)
create or replace function public._restore_order_stock(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.order_items;
  v_stock integer;
begin
  -- Faqat bekor qilingan yoki qaytarilgan buyurtma uchun va faqat bir marta
  if not exists (select 1 from public.orders where id = p_order_id and status in ('cancelled', 'returned') and not stock_restored) then
    return;
  end if;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    if v_item.product_id is null then
      continue;
    end if;
    v_stock := null;
    if v_item.variant_id is not null then
      update public.product_variants set stock = stock + v_item.quantity
      where id = v_item.variant_id returning stock into v_stock;
    else
      update public.products set stock = stock + v_item.quantity
      where id = v_item.product_id and track_stock returning stock into v_stock;
    end if;
    update public.products set sold_count = greatest(sold_count - v_item.quantity, 0) where id = v_item.product_id;
    if v_stock is not null then
      insert into public.inventory_movements (product_id, variant_id, delta, stock_after, reason, order_id, created_by)
      values (v_item.product_id, v_item.variant_id, v_item.quantity, v_stock, p_reason, p_order_id, auth.uid());
    end if;
  end loop;

  update public.orders set stock_restored = true where id = p_order_id;
end;
$$;

-- Status o'tishlari: qaysi holatdan qaysiga o'tish mumkin
create or replace function public.order_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'new' then p_to in ('confirmed', 'processing', 'cancelled')
    when 'confirmed' then p_to in ('processing', 'shipped', 'cancelled')
    when 'processing' then p_to in ('shipped', 'cancelled')
    when 'shipped' then p_to in ('delivered', 'returned')
    when 'delivered' then p_to in ('returned')
    else false
  end;
$$;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status public.order_status default null,
  p_note text default null,
  p_tracking_number text default null,
  p_admin_note text default null,
  p_payment_status public.payment_status default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_title text;
begin
  if not (public.has_perm('orders.write') or public.has_perm('orders.fulfill')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_status is not null and p_status <> v_order.status then
    if not public.order_transition_allowed(v_order.status, p_status) then
      raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
    end if;
    if p_status in ('cancelled', 'returned') and not public.has_perm('orders.cancel') then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    if p_status in ('confirmed', 'delivered') and not public.has_perm('orders.write') then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;

    update public.orders set
      status = p_status,
      confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
      shipped_at = case when p_status = 'shipped' then now() else shipped_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancelled_reason = case when p_status = 'cancelled' then nullif(p_note, '') else cancelled_reason end
    where id = p_order_id;

    if p_status in ('cancelled', 'returned') then
      perform public._restore_order_stock(p_order_id, case when p_status = 'cancelled' then 'cancel' else 'return' end);
      if p_status = 'cancelled' and v_order.coupon_id is not null then
        delete from public.coupon_redemptions where order_id = p_order_id;
        update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_order.coupon_id;
      end if;
    end if;

    insert into public.order_status_history (order_id, status, note, changed_by)
    values (p_order_id, p_status, nullif(p_note, ''), auth.uid());

    if v_order.user_id is not null then
      v_title := case p_status
        when 'confirmed' then 'Buyurtmangiz tasdiqlandi'
        when 'processing' then 'Buyurtmangiz tayyorlanmoqda'
        when 'shipped' then 'Buyurtmangiz jo''natildi'
        when 'delivered' then 'Buyurtmangiz yetkazildi'
        when 'cancelled' then 'Buyurtmangiz bekor qilindi'
        when 'returned' then 'Buyurtma qaytarildi'
        else 'Buyurtma holati yangilandi' end;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_order.user_id, 'order_status', v_title || ' (#' || v_order.number || ')', nullif(p_note, ''),
        '/account/orders/' || v_order.id);
    end if;
  end if;

  if p_tracking_number is not null then
    update public.orders set tracking_number = nullif(trim(p_tracking_number), '') where id = p_order_id;
  end if;

  if p_admin_note is not null then
    update public.orders set admin_note = nullif(trim(p_admin_note), '') where id = p_order_id;
  end if;

  if p_payment_status is not null and p_payment_status <> v_order.payment_status then
    if not public.has_perm('orders.write') then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    update public.orders set payment_status = p_payment_status where id = p_order_id;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- Mijoz o'zining "yangi" holatidagi buyurtmasini bekor qilishi
create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.status <> 'new' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_reason = 'Mijoz bekor qildi'
  where id = p_order_id;
  perform public._restore_order_stock(p_order_id, 'cancel');
  if v_order.coupon_id is not null then
    delete from public.coupon_redemptions where order_id = p_order_id;
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_order.coupon_id;
  end if;
  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order_id, 'cancelled', 'Mijoz bekor qildi', auth.uid());
  insert into public.notifications (user_id, type, title, link)
  values (null, 'order_cancelled', 'Mijoz buyurtmani bekor qildi #' || v_order.number, '/admin/orders/' || v_order.id);
end;
$$;

-- Ombor qoldig'ini qo'lda o'rnatish
create or replace function public.adjust_stock(p_product_id uuid, p_variant_id uuid, p_new_stock integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_old integer;
begin
  if not public.has_perm('inventory.write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'INVALID_STOCK' using errcode = 'P0001';
  end if;

  if p_variant_id is not null then
    select stock into v_old from public.product_variants where id = p_variant_id and product_id = p_product_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    update public.product_variants set stock = p_new_stock where id = p_variant_id;
  else
    select stock into v_old from public.products where id = p_product_id and not has_variants for update;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    update public.products set stock = p_new_stock where id = p_product_id;
  end if;

  if v_old <> p_new_stock then
    insert into public.inventory_movements (product_id, variant_id, delta, stock_after, reason, note, created_by)
    values (p_product_id, p_variant_id, p_new_stock - v_old, p_new_stock, 'manual', p_note, auth.uid());
  end if;
  return p_new_stock;
end;
$$;

-- ---------- Katalog qidiruvi va filtrlar ----------
create or replace function public.category_descendants(p_category_id uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select id from public.categories where id = p_category_id
    union all
    select c.id from public.categories c join tree t on c.parent_id = t.id
  )
  select id from tree;
$$;

-- RLS ishlashi uchun SECURITY INVOKER
create or replace function public.catalog_products(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_q text := nullif(trim(p ->> 'q'), '');
  v_like text;
  v_category uuid;
  v_limit integer := least(greatest(coalesce((p ->> 'limit')::integer, 24), 1), 100);
  v_offset integer := greatest(coalesce((p ->> 'offset')::integer, 0), 0);
  v_sort text := coalesce(p ->> 'sort', 'popular');
  v_colors text[];
  v_sizes text[];
  v_ids uuid[];
  v_result jsonb;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(replace(left(v_q, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if nullif(p ->> 'category', '') is not null then
    select id into v_category from public.categories where slug = p ->> 'category';
    if v_category is null then
      return jsonb_build_object('items', '[]'::jsonb, 'total', 0);
    end if;
  end if;
  if jsonb_typeof(p -> 'colors') = 'array' then
    select array_agg(lower(x)) into v_colors from jsonb_array_elements_text(p -> 'colors') x;
  end if;
  if jsonb_typeof(p -> 'sizes') = 'array' then
    select array_agg(lower(x)) into v_sizes from jsonb_array_elements_text(p -> 'sizes') x;
  end if;
  if jsonb_typeof(p -> 'ids') = 'array' then
    select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p -> 'ids') x;
  end if;

  with filtered as (
    select pr.id, pr.name, pr.slug, pr.price, pr.compare_at_price, pr.image_url, pr.rating_avg, pr.rating_count,
      pr.stock, pr.track_stock, pr.has_variants, pr.category_id, pr.is_new, pr.is_bestseller, pr.sold_count,
      pr.brand, pr.created_at
    from public.products pr
    where pr.is_active
      and (v_category is null or pr.category_id in (select public.category_descendants(v_category)))
      and (v_like is null
        or pr.name ilike v_like
        or pr.sku ilike v_like
        or pr.brand ilike v_like
        or pr.barcode = v_q
        or pr.category_id in (select c.id from public.categories c where c.name ilike v_like))
      and (p ->> 'min_price' is null or pr.price >= (p ->> 'min_price')::bigint)
      and (p ->> 'max_price' is null or pr.price <= (p ->> 'max_price')::bigint)
      and (coalesce((p ->> 'discount')::boolean, false) = false or (pr.compare_at_price is not null and pr.compare_at_price > pr.price))
      and (coalesce((p ->> 'in_stock')::boolean, false) = false or pr.stock > 0 or not pr.track_stock)
      and (p ->> 'min_rating' is null or pr.rating_avg >= (p ->> 'min_rating')::numeric)
      and (coalesce((p ->> 'featured')::boolean, false) = false or pr.is_featured)
      and (coalesce((p ->> 'bestseller')::boolean, false) = false or pr.is_bestseller)
      and (coalesce((p ->> 'new')::boolean, false) = false or pr.is_new)
      and (v_ids is null or pr.id = any (v_ids))
      and (v_colors is null or exists (
        select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and lower(v.color) = any (v_colors)))
      and (v_sizes is null or exists (
        select 1 from public.product_variants v where v.product_id = pr.id and v.is_active and lower(v.size) = any (v_sizes)))
  ),
  page as (
    select f.* from filtered f
    order by
      case when v_sort = 'price_asc' then f.price end asc nulls last,
      case when v_sort = 'price_desc' then f.price end desc nulls last,
      case when v_sort = 'new' then f.created_at end desc nulls last,
      case when v_sort = 'rating' then f.rating_avg end desc nulls last,
      case when v_sort = 'discount' then coalesce(f.compare_at_price, f.price) - f.price end desc nulls last,
      case when v_sort = 'popular' then f.sold_count end desc nulls last,
      (f.stock > 0 or not f.track_stock) desc,
      f.created_at desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', pg.id, 'name', pg.name, 'slug', pg.slug, 'price', pg.price, 'compare_at_price', pg.compare_at_price,
      'image_url', pg.image_url, 'rating_avg', pg.rating_avg, 'rating_count', pg.rating_count,
      'stock', pg.stock, 'track_stock', pg.track_stock, 'has_variants', pg.has_variants,
      'category_id', pg.category_id, 'is_new', pg.is_new, 'is_bestseller', pg.is_bestseller,
      'sold_count', pg.sold_count, 'brand', pg.brand
    )) from page pg), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.catalog_facets(p_category_slug text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with scope as (
    select pr.id, pr.price from public.products pr
    where pr.is_active
      and (p_category_slug is null or pr.category_id in (
        select public.category_descendants((select id from public.categories where slug = p_category_slug))))
  )
  select jsonb_build_object(
    'min_price', (select min(price) from scope),
    'max_price', (select max(price) from scope),
    'colors', coalesce((select jsonb_agg(distinct jsonb_build_object('name', v.color, 'hex', v.color_hex))
      from public.product_variants v where v.is_active and v.color is not null and v.product_id in (select id from scope)), '[]'::jsonb),
    'sizes', coalesce((select jsonb_agg(distinct v.size)
      from public.product_variants v where v.is_active and v.size is not null and v.product_id in (select id from scope)), '[]'::jsonb)
  );
$$;

-- ---------- Admin: dashboard va hisobotlar ----------
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_result jsonb;
begin
  if not public.has_perm('dashboard.view') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'today_sales', coalesce((select sum(total) from public.orders
      where (created_at at time zone 'Asia/Tashkent')::date = v_today and status not in ('cancelled', 'returned')), 0),
    'today_orders', (select count(*) from public.orders where (created_at at time zone 'Asia/Tashkent')::date = v_today),
    'total_sales', coalesce((select sum(total) from public.orders where status not in ('cancelled', 'returned')), 0),
    'orders_count', (select count(*) from public.orders),
    'new_orders', (select count(*) from public.orders where status = 'new'),
    'pending_orders', (select count(*) from public.orders where status in ('confirmed', 'processing', 'shipped')),
    'cancelled_orders', (select count(*) from public.orders where status = 'cancelled'),
    'products_count', (select count(*) from public.products),
    'active_products', (select count(*) from public.products where is_active),
    'low_stock', (select count(*) from public.products where is_active and track_stock and stock <= low_stock_threshold),
    'customers_count', (select count(*) from public.profiles pf where not exists (select 1 from public.user_roles ur where ur.user_id = pf.id)),
    'sales_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day, 'revenue', coalesce(s.revenue, 0), 'orders', coalesce(s.orders, 0)) order by d.day)
      from generate_series(v_today - 29, v_today, interval '1 day') as d (day)
      left join (
        select (created_at at time zone 'Asia/Tashkent')::date as day, sum(total) as revenue, count(*) as orders
        from public.orders
        where created_at >= (v_today - 30)::timestamp at time zone 'Asia/Tashkent' and status not in ('cancelled', 'returned')
        group by 1
      ) s on s.day = d.day::date
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select oi.product_id, max(oi.product_name) as name, sum(oi.quantity) as quantity, sum(oi.line_total) as revenue
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.status not in ('cancelled', 'returned') and o.created_at >= now() - interval '30 days'
        group by oi.product_id
        order by sum(oi.quantity) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(r) from (
        select id, number, customer_name, total, status, created_at from public.orders order by created_at desc limit 8
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.report_sales(p_from date, p_to date, p_granularity text default 'day')
returns table (
  period date,
  orders_count bigint,
  items_sold bigint,
  revenue bigint,
  goods_revenue bigint,
  discounts bigint,
  shipping bigint,
  cost_known bigint,
  gross_profit bigint,
  cancelled_count bigint,
  returned_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('reports.view') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_granularity not in ('day', 'week', 'month') then
    raise exception 'INVALID_GRANULARITY' using errcode = 'P0001';
  end if;

  return query
  with o as (
    select ord.*, date_trunc(p_granularity, ord.created_at at time zone 'Asia/Tashkent')::date as per
    from public.orders ord
    where (ord.created_at at time zone 'Asia/Tashkent')::date between p_from and p_to
  ),
  items as (
    select o.per,
      sum(oi.quantity) as qty,
      sum(oi.cost_price * oi.quantity) filter (where oi.cost_price is not null) as cost,
      sum(oi.line_total - oi.cost_price * oi.quantity) filter (where oi.cost_price is not null) as profit
    from o join public.order_items oi on oi.order_id = o.id
    where o.status not in ('cancelled', 'returned')
    group by o.per
  )
  select o.per,
    count(*) filter (where o.status not in ('cancelled', 'returned')),
    coalesce(max(i.qty), 0)::bigint,
    coalesce(sum(o.total) filter (where o.status not in ('cancelled', 'returned')), 0)::bigint,
    coalesce(sum(o.subtotal - o.discount_total) filter (where o.status not in ('cancelled', 'returned')), 0)::bigint,
    coalesce(sum(o.discount_total) filter (where o.status not in ('cancelled', 'returned')), 0)::bigint,
    coalesce(sum(o.shipping_cost) filter (where o.status not in ('cancelled', 'returned')), 0)::bigint,
    coalesce(max(i.cost), 0)::bigint,
    coalesce(max(i.profit), 0)::bigint,
    count(*) filter (where o.status = 'cancelled'),
    count(*) filter (where o.status = 'returned')
  from o left join items i on i.per = o.per
  group by o.per
  order by o.per;
end;
$$;

create or replace function public.report_products(p_from date, p_to date)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  quantity bigint,
  revenue bigint,
  cost bigint,
  gross_profit bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('reports.view') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select oi.product_id, max(oi.product_name), max(oi.sku),
    sum(oi.quantity)::bigint, sum(oi.line_total)::bigint,
    sum(oi.cost_price * oi.quantity) filter (where oi.cost_price is not null)::bigint,
    sum(oi.line_total - oi.cost_price * oi.quantity) filter (where oi.cost_price is not null)::bigint
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.status not in ('cancelled', 'returned')
    and (o.created_at at time zone 'Asia/Tashkent')::date between p_from and p_to
  group by oi.product_id
  order by sum(oi.quantity) desc;
end;
$$;

create or replace function public.report_status_breakdown(p_from date, p_to date)
returns table (status public.order_status, orders_count bigint, amount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('reports.view') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select o.status, count(*)::bigint, coalesce(sum(o.total), 0)::bigint
  from public.orders o
  where (o.created_at at time zone 'Asia/Tashkent')::date between p_from and p_to
  group by o.status
  order by o.status;
end;
$$;

-- Mijozlar ro'yxati (email auth.users dan emas, profiles dan olinadi)
create or replace function public.admin_customers(p_q text default null, p_limit integer default 25, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := case when nullif(trim(p_q), '') is null then null
    else '%' || replace(replace(replace(left(trim(p_q), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  v_result jsonb;
begin
  if not public.has_perm('customers.read') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with base as (
    select pf.*,
      (select count(*) from public.orders o where o.user_id = pf.id) as orders_count,
      (select coalesce(sum(o.total), 0) from public.orders o where o.user_id = pf.id and o.status not in ('cancelled', 'returned')) as total_spent,
      (select max(o.created_at) from public.orders o where o.user_id = pf.id) as last_order_at
    from public.profiles pf
    where (v_like is null or pf.full_name ilike v_like or pf.phone ilike v_like or pf.email ilike v_like)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((select jsonb_agg(b order by b.created_at desc) from (
      select id, full_name, phone, email, is_blocked, created_at, orders_count, total_spent, last_order_at
      from base order by created_at desc limit least(p_limit, 100) offset greatest(p_offset, 0)
    ) b), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Xodimlar ro'yxati
create or replace function public.admin_staff()
returns table (user_id uuid, email text, full_name text, roles public.app_role[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('staff.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select ur.user_id, pf.email, pf.full_name, array_agg(ur.role order by ur.role)
  from public.user_roles ur left join public.profiles pf on pf.id = ur.user_id
  group by ur.user_id, pf.email, pf.full_name
  order by pf.email;
end;
$$;

-- Birinchi super adminni yaratish: faqat SQL Editor (postgres) yoki service role orqali.
create or replace function public.bootstrap_super_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public._is_trusted_caller() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Foydalanuvchi topilmadi: %. Avval saytda ro''yxatdan o''ting.', p_email;
  end if;
  insert into public.profiles (id, email) values (v_user, p_email) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (v_user, 'super_admin') on conflict do nothing;
  return 'OK: ' || p_email || ' endi super admin';
end;
$$;
