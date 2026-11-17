-- 7 ta imkoniyat testlari: onlayn toʻlov, savat eslatmasi, qoldiq hodisalari, birga olinadi, kargo, hisobotlar.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000061', 'onlayn@test.uz', '{"full_name":"Onlayn Mijoz"}'),
  ('00000000-0000-0000-0000-000000000062', 'kargochi@test.uz', '{"full_name":"Kargochi"}')
on conflict do nothing;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000062', 'super_admin') on conflict do nothing;
insert into public.payment_methods (code, name, kind, provider) values ('t_payme', 'Payme (test)', 'online', 'payme') on conflict (code) do nothing;

-- 1) Onlayn toʻlov: toʻlandi + avtomatik tasdiqlandi, ikkinchi chaqiruv hech narsa qilmaydi, bekor — qaytarildi
do $$
declare v uuid; ok boolean;
begin
  insert into public.cart_reminders (user_id, cart_updated_at, step) values ('00000000-0000-0000-0000-000000000061', now() - interval '5 hours', 1);
  insert into public.orders (user_id, payment_method_id, payment_method_name, payment_provider, shipping_method_name, customer_name, customer_phone, subtotal, total, idempotency_key, tracking_number)
  select '00000000-0000-0000-0000-000000000061', id, name, 'payme', 'Kuryer', 'Onlayn Mijoz', '+998901112233', 50000, 50000, 'online-1', 'YT0000000061'
  from public.payment_methods where code = 't_payme' returning id into v;
  -- savat eslatmasidan keyingi buyurtma — “qaytgan xarid”
  assert (select recovered_order_id from public.cart_reminders where user_id = '00000000-0000-0000-0000-000000000061') = v, 'qaytgan xarid belgilanmadi';
  ok := public._online_payment_paid(v, 'payme', true);
  assert ok, 'toʻlov belgilanmadi';
  assert (select payment_status = 'paid' and status = 'confirmed' from public.orders where id = v), 'toʻlandi/tasdiqlandi emas';
  assert not public._online_payment_paid(v, 'payme', true), 'ikki marta toʻlandi';
  assert exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-000000000061' and type = 'payment'), 'bildirishnoma yoʻq';
  assert public._online_payment_void(v), 'qaytarish ishlamadi';
  assert (select payment_status = 'refunded' from public.orders where id = v), 'qaytarildi emas';
  perform set_config('test.online', v::text, false);
end $$;

-- 3+5) Qoldiq hodisalari: tugadi → qayta keldi, kam qoldi
do $$
declare p uuid;
begin
  select id into p from public.products where not has_variants and track_stock order by created_at limit 1;
  update public.products set stock = 20, low_stock_threshold = 5 where id = p;
  delete from public.stock_events where product_id = p;
  update public.products set stock = 3 where id = p;
  assert exists (select 1 from public.stock_events where product_id = p and kind = 'low'), 'kam qoldi hodisasi yoʻq';
  update public.products set stock = 0 where id = p;
  assert exists (select 1 from public.stock_events where product_id = p and kind = 'out'), 'tugadi hodisasi yoʻq';
  update public.products set stock = 7 where id = p;
  assert exists (select 1 from public.stock_events where product_id = p and kind = 'restock'), 'qayta keldi hodisasi yoʻq';
  update public.products set stock = 8 where id = p;
  assert (select count(*) from public.stock_events where product_id = p) = 3, 'ortiqcha hodisa';
end $$;

-- 4) Birga olinadi: birga sotilgan mahsulot qaytadi, oʻzi qaytmaydi
do $$
declare a uuid; b uuid; o uuid; r uuid[];
begin
  select id into a from public.products where is_active order by created_at limit 1;
  select id into b from public.products where is_active and id <> a order by created_at limit 1;
  insert into public.orders (payment_method_name, shipping_method_name, customer_name, customer_phone, subtotal, total, idempotency_key)
  values ('Naqd', 'Kuryer', 'Test', '+998900000001', 1, 1, 'together-1') returning id into o;
  insert into public.order_items (order_id, product_id, product_name, unit_price, original_price, quantity, line_total)
  values (o, a, 'A', 1, 1, 1, 1), (o, b, 'B', 1, 1, 1, 1);
  r := public.bought_together(array[a], 5);
  assert b = any (r), 'birga olinadi topilmadi';
  assert not (a = any (r)), 'mahsulotning oʻzi qaytdi';
end $$;

-- Mijoz: “Kelganda xabar ber” — faqat oʻziniki; kargo va hisobotlarga ruxsat yoʻq
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000061';
do $$
declare p uuid;
begin
  select id into p from public.products order by created_at limit 1;
  insert into public.stock_alerts (user_id, product_id) values ('00000000-0000-0000-0000-000000000061', p);
  begin
    insert into public.stock_alerts (user_id, product_id) values ('00000000-0000-0000-0000-000000000062', p);
    raise exception 'boshqa odam nomidan obuna';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.stock_alerts) = 1, 'boshqalar obunasi koʻrindi';
  begin
    perform public.admin_cargo_update(array[current_setting('test.online')::uuid], null, 'border', null);
    raise exception 'mijoz kargoni oʻzgartirdi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.report_categories(current_date - 30, current_date);
    raise exception 'mijoz hisobotni koʻrdi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.payment_transactions;
    raise exception 'mijoz tranzaksiyalarni koʻrdi';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Xodim: trek raqami boʻyicha kargo bosqichi, topilmaganlar roʻyxati; hisobotlar
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000062';
do $$
declare r jsonb; v uuid := current_setting('test.online')::uuid;
begin
  r := public.admin_cargo_update(null, array['yt0000000061', 'NOPE123'], 'border', 'Chegarada 2 kun');
  assert jsonb_array_length(r -> 'updated') = 1, 'trek boʻyicha topilmadi';
  assert r -> 'missing' ? 'NOPE123', 'topilmagan trek koʻrsatilmadi';
  assert (select cargo_stage = 'border' from public.orders where id = v), 'bosqich yozilmadi';
  assert (select count(*) from public.cargo_events where order_id = v) = 1, 'kargo tarixi yoʻq';
  assert (select count(*) from public.report_categories(current_date - 30, current_date)) >= 1, 'kategoriya hisoboti boʻsh';
  assert (select count(*) from public.report_payments(current_date - 30, current_date)) >= 1, 'toʻlov hisoboti boʻsh';
  assert (select count(*) from public.report_customers(current_date - 30, current_date, 5)) >= 1, 'mijoz hisoboti boʻsh';
end $$;
reset role;

-- Ochiq kuzatish: trek raqami bilan faqat bosqichlar (shaxsiy maʼlumotsiz)
set role anon;
do $$
declare j jsonb;
begin
  j := public.track_cargo('YT0000000061');
  assert j ->> 'cargo_stage' = 'border', 'trek bilan kuzatish ishlamadi';
  assert not (j ? 'customer_phone') and not (j ? 'customer_name'), 'shaxsiy maʼlumot chiqdi';
  assert public.track_cargo('YT') is null, 'qisqa trek qabul qilindi';
end $$;
reset role;
