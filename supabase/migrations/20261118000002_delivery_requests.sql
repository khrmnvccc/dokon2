-- Yetkazishni oxirida tanlash (kargo yoʻli):
-- Yangi → Tasdiqlandi → Yigʻilmoqda → Yoʻlda → Oʻzbekistonda → (mijoz: yetkazishga ariza yoki oʻzi olib ketadi)
-- → xodim arizani tasdiqlaydi → Yetib bordi → sharh.
-- Faqat ustun/funksiya qoʻshiladi, hech narsa oʻchirilmaydi.

alter table public.orders
  add column if not exists arrived_at timestamptz,
  add column if not exists fulfillment text check (fulfillment in ('delivery', 'pickup')),
  add column if not exists fulfillment_status text check (fulfillment_status in ('requested', 'approved')),
  add column if not exists fulfillment_requested_at timestamptz,
  add column if not exists delivery_fee bigint not null default 0 check (delivery_fee >= 0);

-- Olib ketish punkti: manzil va xarita havolasi (ega oʻzi kiritadi)
alter table public.shipping_methods
  add column if not exists pickup_address text check (char_length(pickup_address) <= 300),
  add column if not exists map_url text check (map_url is null or map_url ~* '^https://'),
  add column if not exists work_hours text check (char_length(work_hours) <= 120);

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
    when 'shipped' then p_to in ('arrived', 'delivered', 'returned')
    when 'arrived' then p_to in ('delivered', 'returned')
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
      arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
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
        when 'arrived' then 'Buyurtmangiz Oʻzbekistonga yetib keldi'
        when 'delivered' then 'Buyurtmangiz yetkazildi'
        when 'cancelled' then 'Buyurtmangiz bekor qilindi'
        when 'returned' then 'Buyurtma qaytarildi'
        else 'Buyurtma holati yangilandi' end;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_order.user_id, 'order_status', v_title || ' (#' || v_order.number || ')',
        coalesce(nullif(p_note, ''), case when p_status = 'arrived' then 'Yetkazib berishga ariza qoldiring yoki oʻzingiz olib keting' end),
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

-- Karta bilan toʻlanadigan buyurtma toʻlanmaguncha yoʻlga chiqmaydi (yangi holat ham qoʻshildi)
create or replace function public._require_card_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'processing', 'shipped', 'arrived', 'delivered') and new.status is distinct from old.status
     and new.payment_status <> 'paid'
     and exists (select 1 from public.payment_methods pm
                 where pm.id = new.payment_method_id and pm.kind = 'bank_transfer' and pm.card is not null) then
    raise exception 'PAYMENT_NOT_CONFIRMED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

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

-- Mijoz: “Oʻzbekistonda” boʻlgan buyurtmasi uchun yetkazishga ariza qoldiradi yoki olib ketish punktini tanlaydi.
-- Tasdiqlanguncha qayta oʻzgartirishi mumkin.
create or replace function public.request_fulfillment(p_order_id uuid, p_kind text, p_method_id uuid, p_address jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_method public.shipping_methods;
  v_fee bigint;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_order.status <> 'arrived' then
    raise exception 'NOT_ARRIVED' using errcode = 'P0001';
  end if;
  if v_order.fulfillment_status = 'approved' then
    raise exception 'ALREADY_APPROVED' using errcode = 'P0001';
  end if;
  if p_kind not in ('delivery', 'pickup') then
    raise exception 'INVALID_KIND' using errcode = 'P0001';
  end if;

  select * into v_method from public.shipping_methods where id = p_method_id and is_active;
  if not found then
    raise exception 'METHOD_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_kind = 'delivery' then
    if not v_method.requires_address then raise exception 'METHOD_UNAVAILABLE' using errcode = 'P0001'; end if;
    if p_address is null or coalesce(trim(p_address ->> 'street'), '') = '' or coalesce(trim(p_address ->> 'region'), '') = '' then
      raise exception 'ADDRESS_REQUIRED' using errcode = 'P0001';
    end if;
    v_fee := case when v_method.free_from is not null and v_order.subtotal - v_order.discount_total >= v_method.free_from
                  then 0 else v_method.price end;
  else
    if v_method.requires_address then raise exception 'METHOD_UNAVAILABLE' using errcode = 'P0001'; end if;
    v_fee := 0;
  end if;

  update public.orders set
    fulfillment = p_kind,
    fulfillment_status = 'requested',
    fulfillment_requested_at = now(),
    shipping_method_id = v_method.id,
    shipping_method_name = v_method.name,
    address = case when p_kind = 'delivery' then jsonb_strip_nulls(jsonb_build_object(
      'region', left(trim(p_address ->> 'region'), 80), 'city', left(nullif(trim(p_address ->> 'city'), ''), 80),
      'street', left(trim(p_address ->> 'street'), 200), 'apartment', left(nullif(trim(p_address ->> 'apartment'), ''), 60),
      'landmark', left(nullif(trim(p_address ->> 'landmark'), ''), 200))) else null end,
    delivery_fee = v_fee
  where id = p_order_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (null, 'delivery_request',
    case when p_kind = 'delivery' then 'Yetkazishga ariza #' else 'Olib ketish #' end || v_order.number,
    v_order.customer_name || ' — ' || v_method.name, '/admin/orders/' || v_order.id);

  return jsonb_build_object('ok', true, 'fee', v_fee);
end;
$$;

-- Xodim: arizani tasdiqlaydi (kuryer yoʻlga chiqadi / olib ketishga tayyor)
create or replace function public.admin_approve_fulfillment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders;
begin
  if not (public.has_perm('orders.write') or public.has_perm('orders.fulfill')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_order.fulfillment is null then raise exception 'NO_REQUEST' using errcode = 'P0001'; end if;

  update public.orders set fulfillment_status = 'approved' where id = p_order_id returning * into v_order;
  insert into public.order_status_history (order_id, status, note, changed_by)
  values (p_order_id, v_order.status,
    case when v_order.fulfillment = 'delivery' then 'Yetkazish arizasi tasdiqlandi' else 'Olib ketishga tayyor' end, auth.uid());
  if v_order.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_order.user_id, 'order_status',
      case when v_order.fulfillment = 'delivery' then 'Arizangiz tasdiqlandi' else 'Buyurtmangiz olib ketishga tayyor' end || ' (#' || v_order.number || ')',
      null, '/account/orders/' || v_order.id);
  end if;
  return v_order;
end;
$$;

revoke all on function public.request_fulfillment(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.request_fulfillment(uuid, text, uuid, jsonb) to authenticated;
revoke all on function public.admin_approve_fulfillment(uuid) from public, anon;
grant execute on function public.admin_approve_fulfillment(uuid) to authenticated;

-- Bosh sahifa hisoblagichlari: “Oʻzbekistonda” ham yetkazilmaganlar qatorida
do $$
declare d text;
begin
  select pg_get_functiondef('public.admin_dashboard_live(integer)'::regprocedure) into d;
  d := replace(d, 'status in (''confirmed'', ''processing'', ''shipped'')', 'status in (''confirmed'', ''processing'', ''shipped'', ''arrived'')');
  execute d;
  select pg_get_functiondef('public.admin_dashboard()'::regprocedure) into d;
  d := replace(d, 'status in (''confirmed'', ''processing'', ''shipped'')', 'status in (''confirmed'', ''processing'', ''shipped'', ''arrived'')');
  execute d;
end $$;
