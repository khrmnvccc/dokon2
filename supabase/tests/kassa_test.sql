-- Kassa uslubidagi admin: shaxsiy ruxsatlar, filiallar va maxfiy jadvallar testlari (db_test.sql dan keyin).
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000011', 'menejer@test.uz'),
  ('00000000-0000-0000-0000-000000000012', 'operator@test.uz')
on conflict do nothing;
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000011', 'manager'),
  ('00000000-0000-0000-0000-000000000012', 'operator')
on conflict do nothing;
insert into public.branches (name) values ('Chilonzor filiali') on conflict do nothing;

-- 1) Ega: hamma narsa, shu jumladan messages.manage; filial cheklovi yo'q
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
  assert public.has_perm('messages.manage'), 'Egada messages.manage yo''q';
  assert public.is_owner(), 'is_owner ishlamadi';
  assert public.my_branches() is null, 'Ega filial bilan cheklandi';
  -- Operatorga faqat buyurtmalarni ko'rish va 2-filial
  perform public.admin_set_staff_access('00000000-0000-0000-0000-000000000012', array['dashboard.view', 'orders.read'], array[2]);
  begin
    perform public.admin_set_staff_access('00000000-0000-0000-0000-000000000001', array['orders.read'], null);
    raise exception 'Ega cheklandi!';
  exception when raise_exception then
    if sqlerrm <> 'OWNER_LOCKED' then raise; end if;
  end;
end $$;
reset role;

-- 2) Operator: faqat berilgan ruxsatlar, faqat o'z filiali
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
do $$ begin
  assert public.has_perm('orders.read'), 'berilgan ruxsat ishlamadi';
  assert not public.has_perm('orders.write'), 'rol ruxsati shaxsiy roʻyxatni chetlab oʻtdi';
  assert not public.has_perm('messages.manage'), 'operator xabarlarni boshqara oladi';
  assert public.branch_ok(2) and not public.branch_ok(1), 'filial cheklovi ishlamadi';
  begin
    perform public.admin_set_staff_access('00000000-0000-0000-0000-000000000012', array['orders.read', 'staff.manage'], null);
    raise exception 'operator oʻziga ruxsat berdi!';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3) Admin (menejer): o'zida yo'q ruxsatni bera olmaydi, messages.manage ni bera olmaydi
insert into public.role_permissions (role, permission) values ('manager', 'staff.manage') on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$ begin
  assert not public.has_perm('messages.manage'), 'Admin standart holda messages.manage ga ega';
  begin
    perform public.admin_set_staff_access('00000000-0000-0000-0000-000000000012', array['messages.manage'], null);
    raise exception 'Admin messages.manage berdi!';
  exception when raise_exception then
    if sqlerrm <> 'PERM_NOT_YOURS' then raise; end if;
  end;
  -- Maxfiy jadvallar: hech qanday satr ko'rinmaydi
  begin perform 1 from public.app_meta; raise exception 'app_meta oʻqildi!'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.broadcasts; raise exception 'broadcasts oʻqildi!'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.telegram_log; raise exception 'telegram_log oʻqildi!'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.role_permissions where role = 'manager' and permission = 'staff.manage';

-- 4) Eski buyurtmalar 1-filialda
do $$ begin
  assert (select count(*) from public.orders where branch_id <> 1) = 0, 'eski buyurtmalar 1-filialga tushmadi';
end $$;

-- 5) Ochiq kuponlar: anon faqat “saytda koʻrsatish” yoqilgan amaldagi kodni koʻradi, jadvalning oʻzi yopiq
insert into public.coupons (code, value, is_public, design) values ('OCHIQ10', 10, true, '{"theme":"blue","badge":"11.11"}'), ('YASHIRIN', 20, false, '{}')
on conflict (code) do nothing;
set role anon;
do $$ begin
  assert (select count(*) from public.public_coupons() where code = 'OCHIQ10') = 1, 'ochiq kupon koʻrinmadi';
  assert (select count(*) from public.public_coupons() where code = 'YASHIRIN') = 0, 'yashirin kupon koʻrindi!';
  begin perform 1 from public.coupons; raise exception 'anon coupons jadvalini oʻqidi!'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.coupons where code in ('OCHIQ10', 'YASHIRIN');
