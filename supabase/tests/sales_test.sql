-- Savdo toʻplami testlari: Xitoydan buyurtma → buyurtma, bonus (qoʻllash, keshbek, bekor qilish), qoʻlda tuzatish.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000071', 'bonus@test.uz', '{"full_name":"Bonus Mijoz"}'),
  ('00000000-0000-0000-0000-000000000072', 'begona@test.uz', '{"full_name":"Begona"}')
on conflict do nothing;
insert into public.site_settings (key, value) values
  ('bonus', '{"enabled":true,"earn_percent":10,"min_order":0,"spend_enabled":true,"max_spend_percent":50,"min_balance":1000}')
on conflict (key) do update set value = excluded.value;

-- 1) Xitoydan buyurtma: narx berilmagan — xato; narx bilan — buyurtma; ikkinchi marta — oʻsha buyurtma; begona — topilmadi
do $$
declare r uuid; pm uuid; res jsonb; res2 jsonb; o public.orders;
begin
  select id into pm from public.payment_methods where is_active and kind <> 'online' order by sort_order limit 1;
  insert into public.import_requests (user_id, customer_name, customer_phone, title, links, quantity)
  values ('00000000-0000-0000-0000-000000000071', 'Bonus Mijoz', '+998901234567', 'Krossovka', array['https://detail.1688.com/offer/1.html'], 2)
  returning id into r;
  begin
    perform public._import_request_to_order(r, '00000000-0000-0000-0000-000000000071', pm);
    raise exception 'narxsiz buyurtma yaratildi';
  exception when others then
    assert sqlerrm = 'NOT_QUOTED', 'kutilgan NOT_QUOTED, keldi: ' || sqlerrm;
  end;
  update public.import_requests set status = 'quoted',
    quote = jsonb_build_object('item_price', 100000, 'service_fee', 20000, 'cargo_fee', 30000, 'valid_until', (now() + interval '2 days')::text)
  where id = r;
  begin
    perform public._import_request_to_order(r, '00000000-0000-0000-0000-000000000072', pm);
    raise exception 'begona qabul qildi';
  exception when others then
    assert sqlerrm = 'NOT_FOUND', 'kutilgan NOT_FOUND, keldi: ' || sqlerrm;
  end;
  res := public._import_request_to_order(r, '00000000-0000-0000-0000-000000000071', pm);
  select * into o from public.orders where id = (res ->> 'id')::uuid;
  assert o.total = 250000, 'jami notoʻgʻri: ' || o.total;
  assert (select count(*) from public.order_items where order_id = o.id) = 3, 'qatorlar soni notoʻgʻri';
  assert (select status from public.import_requests where id = r) = 'accepted', 'soʻrov qabul qilinmadi';
  res2 := public._import_request_to_order(r, '00000000-0000-0000-0000-000000000071', pm);
  assert (res2 ->> 'id') = (res ->> 'id') and (res2 ->> 'duplicate')::boolean, 'takroriy buyurtma';
  perform set_config('test.import_order', o.id::text, false);
end $$;

-- 2) Muddati oʻtgan narx
do $$
declare r uuid; pm uuid;
begin
  select id into pm from public.payment_methods where is_active and kind <> 'online' order by sort_order limit 1;
  insert into public.import_requests (user_id, customer_name, customer_phone, title, status, quote)
  values ('00000000-0000-0000-0000-000000000071', 'Bonus Mijoz', '+998901234567', 'Eski', 'quoted',
    jsonb_build_object('item_price', 1000, 'valid_until', (now() - interval '1 day')::text)) returning id into r;
  begin
    perform public._import_request_to_order(r, '00000000-0000-0000-0000-000000000071', pm);
    raise exception 'muddati oʻtgan narx qabul qilindi';
  exception when others then
    assert sqlerrm = 'QUOTE_EXPIRED', 'kutilgan QUOTE_EXPIRED, keldi: ' || sqlerrm;
  end;
end $$;

-- 3) Bonus: yetkazildi → 10% keshbek; keyingi buyurtmada 50% gacha ishlatiladi; bekor → qaytadi
do $$
declare o1 uuid := current_setting('test.import_order')::uuid; o2 uuid; used bigint; bal bigint;
begin
  update public.orders set status = 'delivered', payment_status = 'paid' where id = o1;
  bal := public.bonus_balance('00000000-0000-0000-0000-000000000071');
  assert bal = 25000, 'keshbek notoʻgʻri: ' || bal;
  assert exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-000000000071' and type = 'bonus'), 'bonus bildirishnomasi yoʻq';
  -- qayta yetkazildi holati ikkinchi marta keshbek bermaydi
  update public.orders set status = 'shipped' where id = o1;
  update public.orders set status = 'delivered' where id = o1;
  assert public.bonus_balance('00000000-0000-0000-0000-000000000071') = 25000, 'keshbek ikki marta';

  insert into public.orders (user_id, payment_method_name, shipping_method_name, customer_name, customer_phone, subtotal, total, idempotency_key)
  values ('00000000-0000-0000-0000-000000000071', 'Naqd', 'Kuryer', 'Bonus Mijoz', '+998901234567', 30000, 30000, 'bonus-1') returning id into o2;
  used := public._bonus_apply(o2, 999999);
  assert used = 15000, '50% chegarasi ishlamadi: ' || used;
  assert (select total from public.orders where id = o2) = 15000, 'jami kamaymadi';
  assert public._bonus_apply(o2, 1000) = 0, 'bonus ikki marta qoʻllandi';
  assert public.bonus_balance('00000000-0000-0000-0000-000000000071') = 10000, 'balans ayrilmadi';
  update public.orders set status = 'cancelled' where id = o2;
  assert public.bonus_balance('00000000-0000-0000-0000-000000000071') = 25000, 'bekor qilinganda qaytmadi';
  -- birinchi buyurtma qaytarildi → keshbek olib qoʻyiladi
  update public.orders set status = 'returned' where id = o1;
  assert public.bonus_balance('00000000-0000-0000-0000-000000000071') = 0, 'keshbek olib qoʻyilmadi';
end $$;

-- 4) Oʻchirilgan bonus — qoʻllanmaydi
do $$
declare o uuid;
begin
  insert into public.bonus_ledger (user_id, amount, kind, note) values ('00000000-0000-0000-0000-000000000071', 5000, 'adjust', 'test');
  update public.site_settings set value = jsonb_set(value, '{enabled}', 'false') where key = 'bonus';
  insert into public.orders (user_id, payment_method_name, shipping_method_name, customer_name, customer_phone, subtotal, total, idempotency_key)
  values ('00000000-0000-0000-0000-000000000071', 'Naqd', 'Kuryer', 'Bonus Mijoz', '+998901234567', 30000, 30000, 'bonus-2') returning id into o;
  assert public._bonus_apply(o, 5000) = 0, 'oʻchiq bonus qoʻllandi';
  update public.site_settings set value = jsonb_set(value, '{enabled}', 'true') where key = 'bonus';
end $$;

-- 5) Mijoz: faqat oʻz balansi; xizmat funksiyalari va qoʻlda tuzatish yopiq
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000071';
do $$ begin
  assert (public.my_bonus() ->> 'balance')::bigint = 5000, 'my_bonus balansi notoʻgʻri';
  assert (select count(*) from public.import_requests) = 2, 'oʻz soʻrovlari koʻrinmadi';
  begin
    perform public.admin_bonus_adjust('00000000-0000-0000-0000-000000000071', 1000000, 'oʻzimga');
    raise exception 'mijoz oʻziga bonus qoʻshdi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public._bonus_apply(gen_random_uuid(), 1);
    raise exception '_bonus_apply mijozga ochiq';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000072';
do $$ begin
  assert (public.my_bonus() ->> 'balance')::bigint = 0, 'begona balans';
  assert not exists (select 1 from public.bonus_ledger), 'begona tarix koʻrindi';
  assert not exists (select 1 from public.import_requests), 'begona soʻrovlar koʻrindi';
end $$;
reset role;
reset request.jwt.claims;
reset request.jwt.claim.sub;
select 'sales_test OK';
