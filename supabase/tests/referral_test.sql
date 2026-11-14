-- Doʻstni taklif qilish va hamkorlar testlari (db_test.sql va kassa_test.sql dan keyin).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000021', 'taklifchi@test.uz', '{"full_name":"Aziz Karimov"}'),
  ('00000000-0000-0000-0000-000000000031', 'dost1@test.uz', '{"full_name":"Doʻst Bir"}'),
  ('00000000-0000-0000-0000-000000000032', 'dost2@test.uz', '{"full_name":"Doʻst Ikki"}'),
  ('00000000-0000-0000-0000-000000000033', 'dost3@test.uz', '{"full_name":"Doʻst Uch"}'),
  ('00000000-0000-0000-0000-000000000034', 'dost4@test.uz', '{"full_name":"Doʻst Tort"}'),
  ('00000000-0000-0000-0000-000000000035', 'dost5@test.uz', '{"full_name":"Doʻst Besh"}'),
  ('00000000-0000-0000-0000-000000000036', 'dost6@test.uz', '{"full_name":"Doʻst Olti"}'),
  ('00000000-0000-0000-0000-000000000037', 'begona@test.uz', '{"full_name":"Begona"}')
on conflict do nothing;

-- Buyurtma yaratish yordamchisi (testda): service role kabi place_order chaqiradi.
create or replace function pg_temp.order_for(p_user uuid, p_key text, p_qty int default 2, p_coupon uuid default null, p_discount bigint default 0)
returns uuid language plpgsql as $$
declare v_pid uuid; v jsonb; v_sub bigint;
begin
  select id into v_pid from public.products where slug = 'kitob-otkan-kunlar';
  v_sub := 69000 * p_qty;
  v := public.place_order(jsonb_build_object('user_id', p_user, 'idempotency_key', p_key, 'customer_name', 'Test',
    'customer_phone', '+99890' || lpad((abs(hashtext(p_key)) % 10000000)::text, 7, '0'),
    'payment_method_name', 'Naqd', 'shipping_method_name', 'K', 'subtotal', v_sub, 'discount_total', p_discount, 'shipping_cost', 0,
    'total', v_sub - p_discount, 'coupon_id', p_coupon,
    'items', jsonb_build_array(jsonb_build_object('product_id', v_pid, 'product_name', 'Kitob', 'quantity', p_qty,
      'unit_price', 69000, 'original_price', 69000, 'line_total', v_sub))));
  return (v ->> 'id')::uuid;
end $$;

-- 1) Bogʻlash: faqat yangi mijoz, oʻzini ham, ikki marta ham, aylanma ham boʻlmaydi
do $$
declare v jsonb; v_no bigint; v_f1 bigint;
begin
  select client_no into v_no from public.profiles where id = '00000000-0000-0000-0000-000000000021';
  select client_no into v_f1 from public.profiles where id = '00000000-0000-0000-0000-000000000031';
  v := public.referral_attach('00000000-0000-0000-0000-000000000031', v_no, 'bot');
  assert (v ->> 'ok')::boolean, 'taklif bogʻlanmadi: ' || v::text;
  assert (v ->> 'welcome_coupon_id') is not null, 'doʻstga sovgʻa kupon berilmadi';
  assert (select owner_id from public.coupons where id = (v ->> 'welcome_coupon_id')::uuid) = '00000000-0000-0000-0000-000000000031', 'kupon egasi notoʻgʻri';
  assert (select referred_by from public.profiles where id = '00000000-0000-0000-0000-000000000031') = '00000000-0000-0000-0000-000000000021', 'referred_by yozilmadi';
  v := public.referral_attach('00000000-0000-0000-0000-000000000031', v_no, 'bot');
  assert v ->> 'reason' = 'already', 'ikki marta bogʻlandi';
  v := public.referral_attach('00000000-0000-0000-0000-000000000021', v_no, 'link');
  assert v ->> 'reason' = 'self', 'oʻzini taklif qildi';
  v := public.referral_attach('00000000-0000-0000-0000-000000000021', v_f1, 'link');
  assert v ->> 'reason' = 'cycle', 'aylanma taklif oʻtdi: ' || v::text;
  v := public.referral_attach('00000000-0000-0000-0000-000000000032', 99999999, 'link');
  assert v ->> 'reason' = 'no_referrer', 'yoʻq ID qabul qilindi';
  -- Buyurtmasi bor mijoz “yangi” emas
  perform pg_temp.order_for('00000000-0000-0000-0000-000000000037', 'ref-old-1', 1);
  v := public.referral_attach('00000000-0000-0000-0000-000000000037', v_no, 'link');
  assert v ->> 'reason' = 'not_new', 'eski mijoz bogʻlandi';
end $$;

-- 2) Mijoz bogʻlanishni oʻzi oʻzgartira olmaydi; jadvallar mijozga yopiq; xodim ishlatadigan funksiyalar yopiq
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
do $$ begin
  update public.profiles set referred_by = null, full_name = 'Doʻst Bir' where id = '00000000-0000-0000-0000-000000000031';
  assert (select count(*) from public.referrals) = 0, 'mijoz takliflar jadvalini koʻrdi';
  assert (select count(*) from public.partners) = 0, 'mijoz hamkorlarni koʻrdi';
  begin
    perform public.referral_attach('00000000-0000-0000-0000-000000000031', 1, 'link');
    raise exception 'referral_attach mijozga ochiq';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public._issue_personal_coupon('00000000-0000-0000-0000-000000000031', 999999, 0, 30, 'gift', 'x', null);
    raise exception '_issue_personal_coupon mijozga ochiq';
  exception when insufficient_privilege then null;
  end;
  assert (public.my_referral() -> 'referred_by' ->> 'name') = 'Aziz', 'my_referral: kim taklif qilgani koʻrinmadi';
  assert jsonb_array_length(public.my_referral() -> 'coupons') = 1, 'my_referral: sovgʻa kupon koʻrinmadi';
end $$;
reset role;
reset request.jwt.claims;
do $$ begin
  assert (select referred_by from public.profiles where id = '00000000-0000-0000-0000-000000000031') = '00000000-0000-0000-0000-000000000021', 'mijoz referred_by ni oʻchirdi';
end $$;

-- 3) Shaxsiy kuponni boshqa odam ishlata olmaydi, egasi ishlata oladi
do $$
declare v_coupon uuid; v_amount bigint;
begin
  select id, value into v_coupon, v_amount from public.coupons where owner_id = '00000000-0000-0000-0000-000000000031' and source = 'welcome';
  begin
    perform pg_temp.order_for('00000000-0000-0000-0000-000000000037', 'ref-steal-1', 2, v_coupon, v_amount);
    raise exception 'begona mijoz shaxsiy kuponni ishlatdi';
  exception when raise_exception then
    if sqlerrm <> 'COUPON_INVALID' then raise; end if;
  end;
  begin
    perform pg_temp.order_for(null, 'ref-steal-2', 2, v_coupon, v_amount);
    raise exception 'mehmon shaxsiy kuponni ishlatdi';
  exception when raise_exception then
    if sqlerrm <> 'COUPON_INVALID' then raise; end if;
  end;
  perform pg_temp.order_for('00000000-0000-0000-0000-000000000031', 'ref-f1-1', 2, v_coupon, v_amount);
  assert (select used_count from public.coupons where id = v_coupon) = 1, 'egasi kuponni ishlata olmadi';
  assert (select status from public.referrals where friend_id = '00000000-0000-0000-0000-000000000031') = 'ordered', 'birinchi buyurtma belgilanmadi';
end $$;

-- 4) Doʻstlar buyurtmasi yetkazilgach — bosqich kuponlari, 5 doʻstdan keyin hamkor
do $$
declare v_no bigint; v_id uuid; i int;
begin
  select client_no into v_no from public.profiles where id = '00000000-0000-0000-0000-000000000021';
  for i in 2..6 loop
    perform public.referral_attach(('00000000-0000-0000-0000-0000000000' || (30 + i))::uuid, v_no, 'link');
  end loop;
  assert (select count(*) from public.referrals where referrer_id = '00000000-0000-0000-0000-000000000021') = 6, 'doʻstlar bogʻlanmadi';

  -- Tasdiqlash hali shart emas (standart — yetkazildi)
  update public.orders set status = 'confirmed' where idempotency_key = 'ref-f1-1';
  assert not exists (select 1 from public.referral_rewards), 'tasdiqlanganda mukofot berildi';
  update public.orders set status = 'delivered' where idempotency_key = 'ref-f1-1';
  assert (select count(*) from public.referral_rewards where referrer_id = '00000000-0000-0000-0000-000000000021') = 1, '1-bosqich berilmadi';
  assert (select c.value from public.referral_rewards r join public.coupons c on c.id = r.coupon_id where r.step = 1) = 10000, '1-bosqich summasi notoʻgʻri';
  -- Qayta “yetkazildi” ikkinchi mukofot bermaydi
  update public.orders set status = 'shipped' where idempotency_key = 'ref-f1-1';
  update public.orders set status = 'delivered' where idempotency_key = 'ref-f1-1';
  assert (select count(*) from public.referral_rewards) = 1, 'bitta doʻst uchun ikki marta mukofot';

  for i in 2..5 loop
    v_id := pg_temp.order_for(('00000000-0000-0000-0000-0000000000' || (30 + i))::uuid, 'ref-f' || i || '-1', 2);
    update public.orders set status = 'delivered' where id = v_id;
  end loop;
  assert (select count(*) from public.referral_rewards where referrer_id = '00000000-0000-0000-0000-000000000021') = 5, '5 bosqich berilmadi';
  assert (select sum(amount) from public.referral_rewards) = 210000, 'mukofotlar summasi notoʻgʻri';
  assert (select count(*) from public.coupons where owner_id = '00000000-0000-0000-0000-000000000021' and source = 'referral') = 5, 'kuponlar yaratilmadi';
  assert (select min_order_amount from public.coupons c join public.referral_rewards r on r.coupon_id = c.id where r.step = 5) = 1000000, 'min summa notoʻgʻri';
  assert (select status from public.partners where user_id = '00000000-0000-0000-0000-000000000021') = 'active', 'hamkor boʻlmadi';

  -- Hamkor: 6-doʻst buyurtmasidan 3% komissiya, bekor boʻlsa — bekor
  v_id := pg_temp.order_for('00000000-0000-0000-0000-000000000036', 'ref-f6-1', 10);
  update public.orders set status = 'delivered' where id = v_id;
  assert (select amount from public.partner_earnings where order_id = v_id) = 20700, 'komissiya notoʻgʻri: ' || coalesce((select amount from public.partner_earnings where order_id = v_id), -1);
  update public.orders set status = 'returned' where id = v_id;
  assert (select status from public.partner_earnings where order_id = v_id) = 'cancelled', 'qaytarilganda komissiya bekor boʻlmadi';
  v_id := pg_temp.order_for('00000000-0000-0000-0000-000000000036', 'ref-f6-2', 10);
  update public.orders set status = 'delivered' where id = v_id;
end $$;

-- 5) Hamkor pul yechishi: tekshiruv muddatida balans yoʻq; muddat oʻtgach — soʻrov, ikkinchisi kutadi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
do $$
declare v jsonb;
begin
  v := public.my_referral();
  assert (v ->> 'qualified')::int = 6, 'my_referral: shartni bajarganlar soni notoʻgʻri';
  assert jsonb_array_length(v -> 'friends') = 6, 'my_referral: doʻstlar roʻyxati';
  assert (v -> 'partner' ->> 'status') = 'active', 'my_referral: hamkor holati';
  assert (v -> 'partner' -> 'balance' ->> 'holding')::bigint = 20700, 'my_referral: tekshiruvdagi summa';
  begin
    perform public.partner_request_payout(50000, '8600 1234 5678 9012');
    raise exception 'tekshiruvdagi pul yechildi';
  exception when raise_exception then
    if sqlerrm not in ('PAYOUT_BALANCE', 'PAYOUT_MIN') then raise; end if;
  end;
end $$;
reset role;
reset request.jwt.claims;
update public.partner_earnings set available_at = now() - interval '1 minute';
insert into public.app_meta (key, value) values ('referral', '{"partner":{"enabled":true,"auto":true,"percent":3,"hold_days":14,"min_payout":10000}}')
on conflict (key) do update set value = excluded.value;
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
do $$ begin
  begin
    perform public.partner_request_payout(30000, '8600 1234 5678 9012');
    raise exception 'balansdan ortiq pul yechildi';
  exception when raise_exception then
    if sqlerrm <> 'PAYOUT_BALANCE' then raise; end if;
  end;
  begin
    perform public.partner_request_payout(15000, '123');
    raise exception 'notoʻgʻri karta qabul qilindi';
  exception when raise_exception then
    if sqlerrm <> 'PAYOUT_CARD' then raise; end if;
  end;
  perform public.partner_request_payout(15000, '8600 1234 5678 9012');
  begin
    perform public.partner_request_payout(5000, '8600 1234 5678 9012');
    raise exception 'ikkinchi soʻrov qabul qilindi';
  exception when raise_exception then
    if sqlerrm not in ('PAYOUT_PENDING', 'PAYOUT_MIN') then raise; end if;
  end;
  perform public.referral_track('share');
  perform public.referral_track('hack');
end $$;
reset role;
reset request.jwt.claims;
do $$ begin
  assert (select count(*) from public.partner_payouts where status = 'requested') = 1, 'soʻrov yozilmadi';
  assert (select count(*) from public.referral_events) = 1, 'harakatlar hisobi notoʻgʻri';
end $$;

-- 6) Ega sozlamasi: oʻchirilgan dastur bogʻlamaydi; Ega xodim sifatida jadvallarni koʻradi
insert into public.app_meta (key, value) values ('referral', '{"enabled":false}')
on conflict (key) do update set value = excluded.value;
do $$ begin
  assert public.referral_attach('00000000-0000-0000-0000-000000000004', 1001, 'link') ->> 'reason' = 'disabled', 'oʻchirilgan dastur ishladi';
end $$;
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.referrals) = 6, 'Ega takliflarni koʻrmadi';
  assert (select count(*) from public.partner_payouts) = 1, 'Ega soʻrovlarni koʻrmadi';
end $$;
reset role;
reset request.jwt.claims;
delete from public.app_meta where key = 'referral';

-- 7) Admin hisobotlari: Ega koʻradi, mijoz koʻrmaydi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare b jsonb; u jsonb;
begin
  b := public.admin_referral_board('partners', '', 50, 0);
  assert (b ->> 'total')::int = 1, 'reyting: hamkorlar soni ' || (b ->> 'total');
  assert (b -> 'rows' -> 0 ->> 'qualified')::int = 6, 'reyting: shartni bajarganlar';
  assert (b -> 'summary' ->> 'requests')::int = 1, 'reyting: soʻrovlar';
  assert (public.admin_referral_board('all', 'Aziz', 50, 0) ->> 'total')::int = 1, 'reyting: qidiruv';
  u := public.admin_referral_usage(now() - interval '1 day', now() + interval '1 day');
  assert (u ->> 'joined')::int = 6 and (u ->> 'qualified')::int = 6, 'foydalanish: voronka ' || u::text;
  assert (u -> 'coupons' -> 'referral' ->> 'count')::int = 5, 'foydalanish: kuponlar';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
do $$ begin
  begin
    perform public.admin_referral_board('all', '', 50, 0);
    raise exception 'mijoz hamkorlar reytingini koʻrdi';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;
