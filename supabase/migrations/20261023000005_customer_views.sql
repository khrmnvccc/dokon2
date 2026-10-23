-- =====================================================================
-- Do'kon: mijozlar uchun xavfsiz ko'rinishlar.
-- Tannarx (cost_price, cost_total) va ichki izohlar (admin_note) mijozga ko'rinmasligi kerak.
-- Shuning uchun buyurtma jadvallarini to'g'ridan-to'g'ri faqat xodimlar o'qiydi, mijozlar esa
-- quyidagi funksiyalar orqali faqat ruxsat etilgan ustunlarni oladi.
-- =====================================================================

alter policy dk_orders_select on public.orders
  using ((select public.has_perm('orders.read')));
alter policy dk_order_items_select on public.order_items
  using ((select public.has_perm('orders.read')));
alter policy dk_order_history_select on public.order_status_history
  using ((select public.has_perm('orders.read')));

-- Buyurtmaning mijozga ko'rsatiladigan qismi
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
    'customer_name', p_order.customer_name, 'customer_phone', p_order.customer_phone, 'customer_email', p_order.customer_email,
    'address', p_order.address, 'comment', p_order.comment, 'subtotal', p_order.subtotal,
    'discount_total', p_order.discount_total, 'coupon_code', p_order.coupon_code, 'shipping_cost', p_order.shipping_cost,
    'total', p_order.total, 'items_count', p_order.items_count, 'tracking_number', p_order.tracking_number,
    'cancelled_reason', p_order.cancelled_reason, 'created_at', p_order.created_at, 'confirmed_at', p_order.confirmed_at,
    'shipped_at', p_order.shipped_at, 'delivered_at', p_order.delivered_at, 'cancelled_at', p_order.cancelled_at,
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

-- Mijozning buyurtmalari ro'yxati
create or replace function public.my_orders(p_status text default null, p_limit integer default 20, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select o.* from public.orders o
    where auth.uid() is not null and o.user_id = auth.uid()
      and (p_status is null or o.status::text = p_status)
  )
  select jsonb_build_object(
    'total', (select count(*) from mine),
    'items', coalesce((
      select jsonb_agg(x.j order by x.created_at desc) from (
        select m.created_at, jsonb_build_object(
          'id', m.id, 'number', m.number, 'status', m.status, 'total', m.total, 'items_count', m.items_count,
          'created_at', m.created_at, 'payment_method_name', m.payment_method_name,
          'images', (select coalesce(jsonb_agg(oi.image_url), '[]'::jsonb) from (
            select i.image_url from public.order_items i where i.order_id = m.id and i.image_url is not null limit 4) oi)
        ) as j
        from mine m order by m.created_at desc
        limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
      ) x), '[]'::jsonb)
  );
$$;

-- Bitta buyurtma: egasi uchun
create or replace function public.my_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() and auth.uid() is not null;
  if not found then
    return null;
  end if;
  return public._order_public_json(v_order);
end;
$$;

-- Buyurtma muvaffaqiyatli sahifasi: tasodifiy token orqali (mehmon xaridorlar ham)
create or replace function public.order_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where public_token = p_token and created_at > now() - interval '30 days';
  if not found then
    return null;
  end if;
  return public._order_public_json(v_order);
end;
$$;

-- Buyurtma holatini kuzatish: raqam + telefon. Ilova tomonida rate limit ham qo'yilgan.
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
    'created_at', v_order.created_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.status, 'created_at', h.created_at) order by h.created_at)
      from public.order_status_history h where h.order_id = v_order.id), '[]'::jsonb)
  );
end;
$$;

-- Tannarxlar: faqat mahsulotlarni tahrirlash yoki hisobot huquqi borlar uchun
create or replace function public.admin_product_costs(p_ids uuid[])
returns table (id uuid, cost_price bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_perm('products.write') or public.has_perm('reports.view')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query select p.id, p.cost_price from public.products p where p.id = any (p_ids);
end;
$$;
