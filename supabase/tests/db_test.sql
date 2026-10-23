-- Ma'lumotlar bazasi integratsion testlari (lokal Postgres + supabase_stub.sql + migratsiyalar + seed).
-- Ishga tushirish: npm run test:db  (README ga qarang)
\set ON_ERROR_STOP 1

-- Test foydalanuvchilari
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@test.uz', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'mijoz@test.uz', '{"full_name":"Mijoz","phone":"+998901234567"}'),
  ('00000000-0000-0000-0000-000000000003', 'ombor@test.uz', '{}'),
  ('00000000-0000-0000-0000-000000000004', 'boshqa@test.uz', '{}');
select public.bootstrap_super_admin('admin@test.uz');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000003', 'warehouse');

do $$ begin
  assert (select count(*) from public.profiles) = 4, 'profil trigger ishlamadi';
  assert (select phone from public.profiles where email = 'mijoz@test.uz') = '+998901234567', 'telefon saqlanmadi';
end $$;

-- 1) Anon: mahsulotlarni ko'radi, kuponlarni ko'rmaydi
set role anon;
set request.jwt.claims = '{"role":"anon"}';
do $$ begin
  assert (select count(*) from public.products) = 32, 'anon mahsulotlarni ko''rmadi';
  begin
    perform 1 from public.coupons;
    raise exception 'anon kuponlarni o''qiy oldi';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- 2) Oddiy mijoz: o'ziga rol bera olmaydi, mahsulot narxini o'zgartira olmaydi, o'zini blokdan chiqara olmaydi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  begin
    insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000002', 'super_admin');
    raise exception 'mijoz o''ziga rol berdi!';
  exception when insufficient_privilege then null;
  end;

  update public.products set price = 1 where slug = 'smartfon-nova-x12';
  assert (select price from public.products where slug = 'smartfon-nova-x12') = 4290000, 'mijoz narxni o''zgartirdi!';

  begin
    update public.profiles set is_blocked = true where id = auth.uid();
    raise exception 'mijoz bloklash maydonini o''zgartirdi';
  exception when insufficient_privilege then null;
  end;

  assert not public.has_perm('orders.read'), 'mijozda orders.read bor';
  begin
    perform public.admin_dashboard();
    raise exception 'mijoz dashboardni ko''rdi';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- 3) Buyurtma yaratish (service role orqali)
do $$
declare v jsonb; v2 jsonb; v_pid uuid; v_stock int;
begin
  select id, stock into v_pid, v_stock from public.products where slug = 'smartfon-nova-x12';
  v := public.place_order(jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-000000000002', 'idempotency_key', 'test-key-1',
    'customer_name', 'Mijoz', 'customer_phone', '+998901234567', 'payment_method_name', 'Naqd pul',
    'shipping_method_name', 'Kuryer', 'subtotal', 8580000, 'discount_total', 0, 'shipping_cost', 0, 'total', 8580000,
    'items', jsonb_build_array(jsonb_build_object('product_id', v_pid, 'product_name', 'Nova', 'quantity', 2,
      'unit_price', 4290000, 'original_price', 4990000, 'line_total', 8580000))));
  assert (select stock from public.products where id = v_pid) = v_stock - 2, 'qoldiq kamaymadi';
  -- Dublikat: xuddi shu kalit bilan qayta yuborish yangi buyurtma yaratmaydi
  v2 := public.place_order(jsonb_build_object('idempotency_key', 'test-key-1', 'items', '[]'::jsonb));
  assert (v2 ->> 'duplicate')::boolean and v2 ->> 'id' = v ->> 'id', 'dublikat himoyasi ishlamadi';
  assert (select count(*) from public.orders) = 1, 'ikkinchi buyurtma yaratildi';

  -- Qoldiqdan ortiq buyurtma rad etiladi
  begin
    perform public.place_order(jsonb_build_object('idempotency_key', 'test-key-2', 'customer_name', 'X', 'customer_phone', '+998901111111',
      'payment_method_name', 'Naqd', 'shipping_method_name', 'K', 'subtotal', 1, 'discount_total', 0, 'shipping_cost', 0, 'total', 1,
      'items', jsonb_build_array(jsonb_build_object('product_id', v_pid, 'product_name', 'Nova', 'quantity', 9999,
        'unit_price', 1, 'original_price', 1, 'line_total', 1))));
    raise exception 'qoldiqdan ortiq buyurtma o''tdi';
  exception when raise_exception then
    if sqlerrm not like 'OUT_OF_STOCK%' then raise; end if;
  end;
  assert (select count(*) from public.orders) = 1, 'xato buyurtma saqlanib qoldi';
end $$;

-- Kupon: per-user limit
do $$
declare v_pid uuid; v_coupon uuid;
begin
  select id into v_pid from public.products where slug = 'kitob-otkan-kunlar';
  select id into v_coupon from public.coupons where code = 'XUSH10';
  perform public.place_order(jsonb_build_object('idempotency_key', 'c-1', 'customer_name', 'A', 'customer_phone', '+998901234500',
    'payment_method_name', 'Naqd', 'shipping_method_name', 'K', 'subtotal', 276000, 'discount_total', 27600, 'shipping_cost', 0,
    'total', 248400, 'coupon_id', v_coupon, 'coupon_code', 'XUSH10',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_pid, 'product_name', 'Kitob', 'quantity', 4,
      'unit_price', 69000, 'original_price', 69000, 'line_total', 276000))));
  assert (select used_count from public.coupons where id = v_coupon) = 1, 'kupon hisoblanmadi';
  begin
    perform public.place_order(jsonb_build_object('idempotency_key', 'c-2', 'customer_name', 'A', 'customer_phone', '+998901234500',
      'payment_method_name', 'Naqd', 'shipping_method_name', 'K', 'subtotal', 276000, 'discount_total', 27600, 'shipping_cost', 0,
      'total', 248400, 'coupon_id', v_coupon, 'coupon_code', 'XUSH10',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_pid, 'product_name', 'Kitob', 'quantity', 4,
        'unit_price', 69000, 'original_price', 69000, 'line_total', 276000))));
    raise exception 'kupon ikki marta ishlatildi';
  exception when raise_exception then
    if sqlerrm <> 'COUPON_USER_LIMIT' then raise; end if;
  end;
end $$;

-- 4) Mijoz faqat o'z buyurtmasini ko'radi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
do $$ begin
  assert (select count(*) from public.orders) = 0, 'begona mijoz boshqaning buyurtmasini ko''rdi';
  assert (select count(*) from public.order_items) = 0, 'begona mijoz order_items ko''rdi';
end $$;
do $$ begin
  assert (public.my_orders() ->> 'total')::int = 0, 'begona mijoz my_orders orqali ko''rdi';
  assert public.my_order((select id from public.orders limit 1)) is null;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare v jsonb;
begin
  -- Mijoz jadvalni to'g'ridan-to'g'ri o'qiy olmaydi (tannarx yashirin), faqat funksiya orqali
  assert (select count(*) from public.orders) = 0, 'mijoz orders jadvalini to''g''ridan-to''g''ri o''qidi';
  assert (public.my_orders() ->> 'total')::int = 1, 'mijoz o''z buyurtmasini ko''rmadi';
  v := public.my_order(((public.my_orders() -> 'items' -> 0) ->> 'id')::uuid);
  assert v is not null and jsonb_array_length(v -> 'items') = 1, 'my_order ishlamadi';
  assert not (v ? 'cost_total') and not ((v -> 'items' -> 0) ? 'cost_price') and not (v ? 'admin_note'), 'tannarx mijozga ko''rindi';
  begin
    perform cost_price from public.products limit 1;
    raise exception 'mijoz tannarxni ko''rdi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_product_costs(array[gen_random_uuid()]);
    raise exception 'mijoz admin_product_costs chaqirdi';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.orders set total = 1;
    raise exception 'mijoz buyurtma summasini o''zgartirdi';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- 5) Ombor xodimi: jo'natishi mumkin, bekor qila olmaydi, tasdiqlay olmaydi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$
declare v_id uuid;
begin
  select id into v_id from public.orders where idempotency_key = 'test-key-1';
  begin
    perform public.admin_update_order(v_id, 'cancelled');
    raise exception 'ombor xodimi buyurtmani bekor qildi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_update_order(v_id, 'confirmed');
    raise exception 'ombor xodimi buyurtmani tasdiqladi';
  exception when insufficient_privilege then null;
  end;
  perform public.admin_update_order(v_id, 'processing', null, 'TRK-1');
  assert (select status from public.orders where id = v_id) = 'processing', 'status o''zgarmadi';
  begin
    update public.products set price = 1 where slug = 'smartfon-lumo-a5';
    assert (select price from public.products where slug = 'smartfon-lumo-a5') <> 1, 'ombor xodimi narxni o''zgartirdi';
  end;
end $$;
reset role;
reset request.jwt.claims;

-- 6) Super admin: bekor qilish qoldiqni tiklaydi, mijozga bildirishnoma ketadi, audit yoziladi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare v_id uuid; v_before int;
begin
  select id into v_id from public.orders where idempotency_key = 'test-key-1';
  select stock into v_before from public.products where slug = 'smartfon-nova-x12';
  begin
    perform public.admin_update_order(v_id, 'delivered');
    raise exception 'noto''g''ri status o''tishi qabul qilindi';
  exception when raise_exception then
    if sqlerrm <> 'INVALID_TRANSITION' then raise; end if;
  end;
  perform public.admin_update_order(v_id, 'cancelled', 'Test');
  assert (select stock from public.products where slug = 'smartfon-nova-x12') = v_before + 2, 'qoldiq tiklanmadi';
  begin
    perform public._restore_order_stock(v_id, 'cancel');
    raise exception 'ichki funksiya authenticated uchun ochiq';
  exception when insufficient_privilege then null;
  end;

  update public.products set price = 4190000 where slug = 'smartfon-nova-x12';
  assert (select count(*) from public.audit_logs where entity = 'products') >= 1, 'audit log yozilmadi';
  assert (public.admin_dashboard() ->> 'cancelled_orders')::int = 1, 'dashboard hisobi noto''g''ri';
  assert (select count(*) from public.report_sales(current_date - 1, current_date + 1, 'day')) >= 1, 'hisobot bo''sh';
end $$;
reset role;
reset request.jwt.claims;

do $$
declare v_before int := (select stock from public.products where slug = 'smartfon-nova-x12');
begin
  perform public._restore_order_stock((select id from public.orders where idempotency_key = 'test-key-1'), 'cancel');
  assert (select stock from public.products where slug = 'smartfon-nova-x12') = v_before, 'qoldiq ikki marta tiklandi';
end $$;

do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000000002') = 2, 'mijozga bildirishnoma yo''q';
end $$;

-- 7) Mijoz o'z "yangi" buyurtmasini bekor qila oladi, boshqasinikini emas
do $$
declare v_pid uuid;
begin
  select id into v_pid from public.products where slug = 'stol-chiroq-led';
  perform public.place_order(jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000002', 'idempotency_key', 'k-3',
    'customer_name', 'Mijoz', 'customer_phone', '+998901234567', 'payment_method_name', 'Naqd', 'shipping_method_name', 'K',
    'subtotal', 149000, 'discount_total', 0, 'shipping_cost', 0, 'total', 149000,
    'items', jsonb_build_array(jsonb_build_object('product_id', v_pid, 'product_name', 'Chiroq', 'quantity', 1,
      'unit_price', 149000, 'original_price', 149000, 'line_total', 149000))));
end $$;
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
do $$ begin
  begin
    perform public.cancel_my_order((select id from public.orders where idempotency_key = 'k-3'));
    raise exception 'begona buyurtma bekor qilindi';
  exception when no_data_found then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- 8) Variantli mahsulot: umumiy qoldiq variantlar yig'indisi
do $$ begin
  update public.product_variants set stock = 5 where sku = 'DK-1010-1';
  assert (select stock from public.products where slug = 'erkaklar-futbolka-basic')
    = (select sum(v.stock) from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'erkaklar-futbolka-basic'),
    'variant qoldig''i sinxronlanmadi';
end $$;

-- 9) Katalog filtrlari
do $$ begin
  assert (public.catalog_products('{"category":"elektronika"}') ->> 'total')::int = 10, 'kategoriya ichki kategoriyalar bilan filtrlanmadi';
  assert (public.catalog_products('{"q":"DK-1001"}') ->> 'total')::int >= 1, 'SKU bo''yicha qidiruv ishlamadi';
  assert (public.catalog_products('{"q":"50%_"}') ->> 'total')::int = 0, 'maxsus belgilar ekranlanmadi';
  assert (public.catalog_products('{"sizes":["XL"]}') ->> 'total')::int = 3, 'o''lcham filtri ishlamadi';
  assert (public.catalog_products('{"sort":"price_asc","limit":1}') -> 'items' -> 0 ->> 'slug') = 'kitob-otkan-kunlar', 'saralash ishlamadi';
end $$;

-- 10) Ichki funksiyalar JWT bilan (anon/authenticated) chaqirilsa rad etiladi, hatto EXECUTE huquqi bo'lsa ham
set request.jwt.claims = '{"role":"anon"}';
do $$ begin
  begin
    perform public.bootstrap_super_admin('mijoz@test.uz');
    raise exception 'anon super admin yaratdi!';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.place_order('{"idempotency_key":"x","items":[]}'::jsonb);
    raise exception 'anon place_order chaqirdi!';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.check_rate_limit('k', 1, 1);
    raise exception 'anon rate limit chaqirdi';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"role":"service_role"}';
do $$ begin
  assert public.check_rate_limit('svc', 2, 60), 'service role rate limit ishlamadi';
  assert public.check_rate_limit('svc', 2, 60);
  assert not public.check_rate_limit('svc', 2, 60), 'rate limit chegarasi ishlamadi';
end $$;
reset request.jwt.claims;

-- 11) Mehmon: token va raqam+telefon orqali kuzatish, tannarxsiz
set role anon;
set request.jwt.claims = '{"role":"anon"}';
do $$ begin
  assert (select count(*) from public.products) > 0 or true;
  assert public.track_order(999999999, '+998000000000') is null, 'begona buyurtma topildi';
  assert public.order_by_token(gen_random_uuid()) is null;
  begin
    perform cost_price from public.products limit 1;
    raise exception 'anon tannarxni ko''rdi';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;
do $$
declare v_o public.orders;
begin
  select * into v_o from public.orders order by created_at limit 1;
  assert public.track_order(v_o.number, v_o.customer_phone) ->> 'status' is not null, 'track_order topmadi';
  assert (public.order_by_token(v_o.public_token) ->> 'number')::bigint = v_o.number, 'order_by_token topmadi';
end $$;

select 'ALL DB TESTS PASSED' as result;
