-- Mijoz kupon hamyoni (my_coupon_wallet) testlari (referral_test.sql dan keyin).
\set ON_ERROR_STOP 1

insert into public.coupons (code, description, discount_type, value, is_public, is_active, starts_at, ends_at, per_user_limit) values
  ('W_OCHIQ', 'ochiq', 'fixed', 1000, true, true, now() - interval '1 day', now() + interval '10 days', 1),
  ('W_ERTAGA', 'ertadan', 'percent', 10, true, true, now() + interval '1 day', now() + interval '10 days', 1),
  ('W_YOPIQ', 'yopiq, yuborilgan', 'fixed', 2000, false, true, null, null, 1),
  ('W_BEGONA', 'yopiq, yuborilmagan', 'fixed', 3000, false, true, null, null, 1),
  ('W_ESKI', 'muddati oʻtgan', 'fixed', 4000, true, true, null, now() - interval '1 day', 1),
  ('W_UZOQ', '90 kundan keyin', 'fixed', 5000, true, true, now() + interval '90 days', null, 1)
on conflict (code) do nothing;
insert into public.coupon_sends (coupon_id, user_id)
select id, '00000000-0000-0000-0000-000000000032' from public.coupons where code = 'W_YOPIQ'
on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000032';
do $$
declare w jsonb := public.my_coupon_wallet(); codes text[];
begin
  select array_agg(x ->> 'code') into codes from jsonb_array_elements(w) x where x ->> 'code' like 'W\_%';
  assert 'W_OCHIQ' = any(codes), 'ochiq kupon koʻrinmadi';
  assert 'W_ERTAGA' = any(codes), 'ertadan boshlanadigan ochiq kupon koʻrinmadi';
  assert 'W_YOPIQ' = any(codes), 'botda yuborilgan yopiq kupon koʻrinmadi';
  assert not ('W_BEGONA' = any(codes)), 'yuborilmagan yopiq kupon koʻrindi';
  assert not ('W_ESKI' = any(codes)), 'muddati oʻtgan kupon koʻrindi';
  assert not ('W_UZOQ' = any(codes)), '60 kundan uzoq kupon koʻrindi';
  assert codes[array_length(codes, 1)] = 'W_ERTAGA', 'boshlanmagan kupon oxirida emas';
  begin
    perform 1 from public.coupon_sends;
    raise exception 'coupon_sends mijozga ochiq';
  exception when insufficient_privilege then null;
  end;
end $$;
-- boshqa mijoz yopiq kuponni koʻrmaydi
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000033';
do $$ begin
  assert not exists (select 1 from jsonb_array_elements(public.my_coupon_wallet()) x where x ->> 'code' = 'W_YOPIQ'), 'yopiq kupon begonaga koʻrindi';
end $$;
reset role;
reset request.jwt.claims;
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  begin
    perform public.my_coupon_wallet();
    raise exception 'my_coupon_wallet anon uchun ochiq';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'wallet_test OK';
