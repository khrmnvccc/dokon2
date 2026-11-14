-- Kartaga toʻlov va chek tasdiqlash testlari (wallet_test.sql dan keyin).
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000051', 'kartachi@test.uz', '{"full_name":"Karta Mijoz"}'),
  ('00000000-0000-0000-0000-000000000052', 'kassir@test.uz', '{"full_name":"Kassir"}')
on conflict do nothing;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000052', 'super_admin') on conflict do nothing;

insert into public.payment_methods (code, name, kind, card) values
  ('t_card', 'Kartaga oʻtkazma', 'bank_transfer', '{"number":"8600123412341234","holder":"TEST"}'),
  ('t_cash', 'Naqd (test)', 'cash', null)
on conflict (code) do nothing;

insert into public.orders (user_id, payment_method_id, payment_method_name, shipping_method_name, customer_name, customer_phone, subtotal, total, idempotency_key)
select '00000000-0000-0000-0000-000000000051', id, name, 'Kuryer', 'Karta Mijoz', '+998901234567', 100000, 100000, 'card-' || code
from public.payment_methods where code in ('t_card', 't_cash')
on conflict (idempotency_key) do nothing;

do $$
declare v_card uuid; v_cash uuid; r1 uuid; r2 uuid;
begin
  select id into v_card from public.orders where idempotency_key = 'card-t_card';
  select id into v_cash from public.orders where idempotency_key = 'card-t_cash';
  -- naqd buyurtma toʻlovsiz joʻnatiladi
  update public.orders set status = 'shipped' where id = v_cash;
  -- kartaga toʻlov tasdiqlanmaguncha joʻnatilmaydi
  begin
    update public.orders set status = 'shipped' where id = v_card;
    raise exception 'tasdiqlanmagan karta toʻlovi joʻnatildi';
  exception when raise_exception then
    if sqlerrm <> 'PAYMENT_NOT_CONFIRMED' then raise; end if;
  end;
  update public.orders set status = 'confirmed' where id = v_card; -- boshqa holatlar mumkin
  insert into public.payment_receipts (order_id, path, mime, size, uploaded_by)
  values (v_card, v_card || '/a.jpg', 'image/jpeg', 1000, '00000000-0000-0000-0000-000000000051') returning id into r1;
  insert into public.payment_receipts (order_id, path, mime, size, uploaded_by)
  values (v_card, v_card || '/b.jpg', 'image/jpeg', 1000, '00000000-0000-0000-0000-000000000051') returning id into r2;
  perform set_config('test.card', v_card::text, false);
  perform set_config('test.r1', r1::text, false);
  perform set_config('test.r2', r2::text, false);
end $$;

-- mijoz chekni tasdiqlay olmaydi va cheklarni koʻrmaydi
set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000051';
do $$ begin
  begin
    perform public.admin_review_receipt(current_setting('test.r1')::uuid, true);
    raise exception 'mijoz chekni tasdiqladi';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from public.payment_receipts), 'mijoz cheklarni koʻrdi';
end $$;

-- xodim: izohsiz rad etib boʻlmaydi, rad etadi, keyin ikkinchisini tasdiqlaydi
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000052';
do $$
declare v_card uuid := current_setting('test.card')::uuid;
begin
  begin
    perform public.admin_review_receipt(current_setting('test.r1')::uuid, false, '  ');
    raise exception 'izohsiz rad etildi';
  exception when raise_exception then
    if sqlerrm <> 'NOTE_REQUIRED' then raise; end if;
  end;
  perform public.admin_review_receipt(current_setting('test.r1')::uuid, false, 'Summa notoʻgʻri');
  assert (select status from public.payment_receipts where id = current_setting('test.r1')::uuid) = 'rejected', 'rad etilmadi';
  assert (select payment_status::text from public.orders where id = v_card) = 'pending', 'rad etilganda toʻlandi boʻldi';
  begin
    perform public.admin_review_receipt(current_setting('test.r1')::uuid, true);
    raise exception 'qaror qayta oʻzgardi';
  exception when raise_exception then
    if sqlerrm <> 'RECEIPT_DECIDED' then raise; end if;
  end;
  perform public.admin_review_receipt(current_setting('test.r2')::uuid, true);
  assert (select payment_status::text from public.orders where id = v_card) = 'paid', 'tasdiqlanganda toʻlanmadi';
end $$;
reset role;
reset request.jwt.claims;
reset request.jwt.claim.sub;

do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000000051' and type = 'payment') = 2, 'mijozga xabar bormadi';
end $$;
-- tasdiqlangandan keyin joʻnatish mumkin
update public.orders set status = 'shipped' where id = current_setting('test.card')::uuid;

set role anon;
do $$ begin
  begin
    perform 1 from public.payment_receipts;
    raise exception 'payment_receipts anon uchun ochiq';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'card_payment_test OK';
