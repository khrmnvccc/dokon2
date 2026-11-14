-- =====================================================================
-- Doʻstni taklif qilish va hamkorlar (marketing).
--  • Mijoz oʻz havolasini (bot: ?start=ref_<ID>, sayt: /r/<ID>) doʻstiga yuboradi.
--  • Doʻst birinchi buyurtmasini olganda (Ega tanlagan holat, standart — “Yetkazildi”) taklif qilgan
--    mijoz bosqichma-bosqich shaxsiy kupon oladi (1 doʻst → 10 000, 2 → 20 000 …).
--  • Hamma bosqichdan oʻtgan mijoz Hamkor boʻladi: doʻstlari buyurtmalaridan foiz (komissiya) oladi
--    va pulini yechib olishni soʻraydi. Barcha qoidalar Ega qoʻlida (app_meta 'referral').
-- Idempotent: faqat yangi jadval/ustun/funksiya qoʻshiladi, mavjud maʼlumot oʻchirilmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261116000001"')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------- Ruxsat ----------
insert into public.role_permissions (role, permission)
values ('super_admin', 'partners.manage'), ('manager', 'partners.manage')
on conflict do nothing;

-- ---------- Shaxsiy kuponlar ----------
-- owner_id — faqat shu mijoz ishlata oladi (boshqa odam kodni bilsa ham). source — qayerdan berilgan.
alter table public.coupons add column if not exists owner_id uuid references auth.users (id) on delete cascade;
alter table public.coupons add column if not exists source text not null default 'manual';
alter table public.coupons add column if not exists issued_by uuid references auth.users (id) on delete set null;
do $$ begin
  alter table public.coupons add constraint coupons_source_chk check (source in ('manual', 'referral', 'welcome', 'gift'));
exception when duplicate_object then null; end $$;
create index if not exists coupons_owner_idx on public.coupons (owner_id, created_at desc) where owner_id is not null;
create index if not exists coupons_source_idx on public.coupons (source, created_at desc);

-- Shaxsiy kuponni boshqa mijoz ishlata olmaydi: buyurtma yozilayotganda tekshiriladi.
create or replace function public._coupon_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.coupons where id = new.coupon_id;
  if v_owner is not null and new.user_id is distinct from v_owner then
    raise exception 'COUPON_INVALID' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists coupon_owner_guard on public.coupon_redemptions;
create trigger coupon_owner_guard before insert on public.coupon_redemptions
  for each row execute function public._coupon_owner_guard();

-- ---------- Takliflar ----------
alter table public.profiles add column if not exists referred_by uuid references auth.users (id) on delete set null;

-- Mijoz oʻz profilini tahrirlaganda “kim taklif qilgan”ni oʻzgartira olmaydi (faqat server bogʻlaydi).
create or replace function public.keep_referred_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then new.referred_by := old.referred_by; end if;
  return new;
end;
$$;
drop trigger if exists keep_referred_by on public.profiles;
create trigger keep_referred_by before update on public.profiles
  for each row execute function public.keep_referred_by();

create table if not exists public.referrals (
  friend_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'link' check (source in ('bot', 'link', 'webapp', 'admin')),
  status text not null default 'joined' check (status in ('joined', 'ordered', 'qualified')),
  first_order_id uuid references public.orders (id) on delete set null,
  qualified_order_id uuid references public.orders (id) on delete set null,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_not_self check (friend_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
create index if not exists referrals_created_idx on public.referrals (created_at desc);

-- Har bosqich uchun bitta mukofot (qayta berilmaydi).
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  step integer not null check (step between 1 and 20),
  friends integer not null,
  amount bigint not null check (amount >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referrer_id, step)
);
create index if not exists referral_rewards_created_idx on public.referral_rewards (created_at desc);
create index if not exists referral_rewards_unnotified_idx on public.referral_rewards (created_at) where notified_at is null;

-- Mijoz harakatlari: “Ulashish” bosildi, havola nusxalandi, havola orqali kirildi.
create table if not exists public.referral_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null check (kind in ('share', 'copy', 'open', 'view')),
  created_at timestamptz not null default now()
);
create index if not exists referral_events_created_idx on public.referral_events (created_at desc);
create index if not exists referral_events_user_idx on public.referral_events (user_id, created_at desc);

-- ---------- Hamkorlar ----------
create table if not exists public.partners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'frozen', 'rejected')),
  commission_percent numeric(5, 2) not null default 3 check (commission_percent >= 0 and commission_percent <= 50),
  card text check (char_length(card) <= 40),
  note text check (char_length(note) <= 500),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists partners_status_idx on public.partners (status, applied_at desc);

-- Har bir doʻst buyurtmasidan hisoblangan komissiya. available_at gacha “tekshiruvda” (qaytarish muddati).
create table if not exists public.partner_earnings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (user_id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  friend_id uuid references auth.users (id) on delete set null,
  base_amount bigint not null check (base_amount >= 0),
  percent numeric(5, 2) not null,
  amount bigint not null check (amount >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists partner_earnings_partner_idx on public.partner_earnings (partner_id, created_at desc);

-- Pul yechish soʻrovlari va Ega qayd qilgan toʻlovlar.
create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (user_id) on delete cascade,
  amount bigint not null check (amount > 0),
  card text check (char_length(card) <= 40),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  note text check (char_length(note) <= 500),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);
create index if not exists partner_payouts_partner_idx on public.partner_payouts (partner_id, requested_at desc);
create index if not exists partner_payouts_status_idx on public.partner_payouts (status, requested_at desc);

-- RLS: mijozlar faqat quyidagi funksiyalar orqali; xodim — partners.manage ruxsati bilan.
alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_events enable row level security;
alter table public.partners enable row level security;
alter table public.partner_earnings enable row level security;
alter table public.partner_payouts enable row level security;
do $$
declare t text;
begin
  foreach t in array array['referrals', 'referral_rewards', 'referral_events', 'partners', 'partner_earnings', 'partner_payouts'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', 'dk_' || t || '_staff', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.has_perm(%L))) with check ((select public.has_perm(%L)))',
      'dk_' || t || '_staff', t, 'partners.manage', 'partners.manage');
  end loop;
end $$;

-- ---------- Sozlamalar ----------
-- Ega Qoidalar sahifasida oʻzgartiradi; saqlanmagan maydonlar standart qiymatda qoladi.
create or replace function public._referral_cfg()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', true,
    'qualify_on', 'delivered',
    'friend_min_order', 0,
    'coupon_days', 30,
    'steps', jsonb_build_array(
      jsonb_build_object('friends', 1, 'amount', 10000, 'min_order', 100000),
      jsonb_build_object('friends', 2, 'amount', 20000, 'min_order', 200000),
      jsonb_build_object('friends', 3, 'amount', 30000, 'min_order', 300000),
      jsonb_build_object('friends', 4, 'amount', 50000, 'min_order', 500000),
      jsonb_build_object('friends', 5, 'amount', 100000, 'min_order', 1000000)
    ),
    'welcome', jsonb_build_object('enabled', true, 'amount', 10000, 'min_order', 100000, 'days', 30),
    'partner', jsonb_build_object('enabled', true, 'auto', true, 'percent', 3, 'hold_days', 14, 'min_payout', 50000),
    'design', jsonb_build_object('theme', 'blue', 'badge', '')
  ) || coalesce((select value from public.app_meta where key = 'referral' and jsonb_typeof(value) = 'object'), '{}'::jsonb);
$$;

-- ---------- Ichki: shaxsiy kupon yaratish ----------
create or replace function public._issue_personal_coupon(
  p_owner uuid, p_amount bigint, p_min_order bigint, p_days integer, p_source text, p_description text, p_issued_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text;
  v_design jsonb := coalesce(public._referral_cfg() -> 'design', '{}'::jsonb);
begin
  if p_amount is null or p_amount <= 0 then return null; end if;
  for i in 1..8 loop
    v_code := 'DK' || upper(substr(md5(random()::text || clock_timestamp()::text || p_owner::text), 1, 8));
    begin
      insert into public.coupons (code, description, discount_type, value, min_order_amount, scope, starts_at, ends_at,
        usage_limit, per_user_limit, is_active, design, owner_id, source, issued_by)
      values (v_code, left(p_description, 200), 'fixed', p_amount, greatest(coalesce(p_min_order, 0), 0), 'all', now(),
        now() + make_interval(days => greatest(coalesce(p_days, 30), 1)), 1, 1, true,
        case when jsonb_typeof(v_design) = 'object' then v_design else '{}'::jsonb end, p_owner, p_source, p_issued_by)
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      null; -- kod band: boshqasini olamiz
    end;
  end loop;
  raise exception 'COUPON_CODE_FAILED';
end;
$$;

-- ---------- Taklifni bogʻlash (faqat server: bot, mini-ilova, sayt) ----------
-- Faqat yangi mijoz: hali buyurtmasi yoʻq, akkaunti 7 kundan yangi, oldin hech kim taklif qilmagan.
create or replace function public.referral_attach(p_friend uuid, p_ref_no bigint, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public._referral_cfg();
  v_ref public.profiles;
  v_friend public.profiles;
  v_welcome uuid;
  w jsonb := v_cfg -> 'welcome';
begin
  if not public._is_trusted_caller() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not coalesce((v_cfg ->> 'enabled')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'disabled'); end if;
  select * into v_ref from public.profiles where client_no = p_ref_no;
  if not found or v_ref.is_blocked then return jsonb_build_object('ok', false, 'reason', 'no_referrer'); end if;
  select * into v_friend from public.profiles where id = p_friend for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_friend'); end if;
  if v_ref.id = v_friend.id then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if v_friend.referred_by is not null or exists (select 1 from public.referrals where friend_id = p_friend) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if exists (select 1 from public.orders where user_id = p_friend) then return jsonb_build_object('ok', false, 'reason', 'not_new'); end if;
  if v_friend.created_at < now() - interval '7 days' then return jsonb_build_object('ok', false, 'reason', 'not_new'); end if;
  if exists (select 1 from public.user_roles where user_id = p_friend) then return jsonb_build_object('ok', false, 'reason', 'staff'); end if;
  -- Aylanma taklif (A → B, B → A) boʻlmaydi
  if exists (select 1 from public.referrals where friend_id = v_ref.id and referrer_id = p_friend) then
    return jsonb_build_object('ok', false, 'reason', 'cycle');
  end if;

  insert into public.referrals (friend_id, referrer_id, source)
  values (p_friend, v_ref.id, case when p_source in ('bot', 'link', 'webapp', 'admin') then p_source else 'link' end);
  update public.profiles set referred_by = v_ref.id where id = p_friend;

  if coalesce((w ->> 'enabled')::boolean, false) and coalesce((w ->> 'amount')::bigint, 0) > 0 then
    v_welcome := public._issue_personal_coupon(p_friend, (w ->> 'amount')::bigint, coalesce((w ->> 'min_order')::bigint, 0),
      coalesce((w ->> 'days')::integer, 30), 'welcome', 'Doʻst taklifi uchun sovgʻa');
    insert into public.notifications (user_id, type, title, body, link)
    values (p_friend, 'coupon', 'Sizga sovgʻa kupon berildi', 'Doʻstingiz taklifi uchun — birinchi buyurtmangizda ishlating', '/account/referral');
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (v_ref.id, 'referral', 'Doʻstingiz qoʻshildi',
    coalesce(nullif(split_part(v_friend.full_name, ' ', 1), ''), 'Doʻstingiz') || ' havolangiz orqali roʻyxatdan oʻtdi', '/account/referral');

  return jsonb_build_object('ok', true, 'referrer_id', v_ref.id, 'welcome_coupon_id', v_welcome);
end;
$$;

-- ---------- Buyurtma holati oʻzgarganda: bosqich mukofotlari va hamkor komissiyasi ----------
create or replace function public._referral_on_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_ref public.referrals;
  v_count integer;
  v_step jsonb;
  v_idx integer;
  v_coupon uuid;
  v_steps integer;
  v_partner public.partners;
  v_base bigint;
  p jsonb;
begin
  -- Birinchi buyurtma berildi
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      update public.referrals set status = 'ordered', first_order_id = new.id
      where friend_id = new.user_id and status = 'joined';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status or new.user_id is null then return new; end if;

  -- Bekor/qaytarildi: hamkor komissiyasi bekor qilinadi
  if new.status in ('cancelled', 'returned') then
    update public.partner_earnings set status = 'cancelled' where order_id = new.id and status = 'active';
    return new;
  end if;

  v_cfg := public._referral_cfg();
  select * into v_ref from public.referrals where friend_id = new.user_id;
  if not found then return new; end if;

  -- Hamkor komissiyasi: doʻstning “Yetkazildi” boʻlgan har bir buyurtmasidan
  if new.status = 'delivered' then
    select * into v_partner from public.partners where user_id = v_ref.referrer_id and status = 'active';
    if found and v_partner.commission_percent > 0 then
      v_base := greatest(new.subtotal - new.discount_total, 0);
      insert into public.partner_earnings (partner_id, order_id, friend_id, base_amount, percent, amount, available_at)
      values (v_partner.user_id, new.id, new.user_id, v_base, v_partner.commission_percent,
        floor(v_base * v_partner.commission_percent / 100),
        now() + make_interval(days => greatest(coalesce((v_cfg #>> '{partner,hold_days}')::integer, 0), 0)))
      on conflict (order_id) do nothing;
    end if;
  end if;

  -- Doʻst shartni bajardi (birinchi marta)
  if v_ref.status = 'qualified' or not coalesce((v_cfg ->> 'enabled')::boolean, false) then return new; end if;
  if not (new.status::text = coalesce(v_cfg ->> 'qualify_on', 'delivered')
          or (coalesce(v_cfg ->> 'qualify_on', 'delivered') = 'confirmed' and new.status in ('processing', 'shipped', 'delivered'))) then
    return new;
  end if;
  if new.total < coalesce((v_cfg ->> 'friend_min_order')::bigint, 0) then return new; end if;

  update public.referrals set status = 'qualified', qualified_at = now(), qualified_order_id = new.id,
    first_order_id = coalesce(first_order_id, new.id)
  where friend_id = new.user_id;

  select count(*) into v_count from public.referrals where referrer_id = v_ref.referrer_id and status = 'qualified';
  v_steps := coalesce(jsonb_array_length(v_cfg -> 'steps'), 0);

  v_idx := 0;
  for v_step in select value from jsonb_array_elements(coalesce(v_cfg -> 'steps', '[]'::jsonb)) loop
    v_idx := v_idx + 1;
    exit when v_idx > 20;
    if v_count >= coalesce((v_step ->> 'friends')::integer, 999999)
       and not exists (select 1 from public.referral_rewards where referrer_id = v_ref.referrer_id and step = v_idx) then
      v_coupon := public._issue_personal_coupon(v_ref.referrer_id, coalesce((v_step ->> 'amount')::bigint, 0),
        coalesce((v_step ->> 'min_order')::bigint, 0), coalesce((v_cfg ->> 'coupon_days')::integer, 30), 'referral',
        'Doʻst taklifi: ' || v_idx || '-bosqich');
      insert into public.referral_rewards (referrer_id, step, friends, amount, coupon_id)
      values (v_ref.referrer_id, v_idx, coalesce((v_step ->> 'friends')::integer, 0), coalesce((v_step ->> 'amount')::bigint, 0), v_coupon)
      on conflict (referrer_id, step) do nothing;
      insert into public.notifications (user_id, type, title, body, link)
      values (v_ref.referrer_id, 'coupon', 'Sizga kupon berildi',
        v_idx || '-bosqich: doʻstlaringiz uchun ' || coalesce((v_step ->> 'amount')::bigint, 0) || ' soʻm', '/account/referral');
    end if;
  end loop;

  -- Hamma bosqich bajarildi → hamkor
  p := coalesce(v_cfg -> 'partner', '{}'::jsonb);
  if v_steps > 0 and coalesce((p ->> 'enabled')::boolean, false)
     and v_count >= coalesce((v_cfg -> 'steps' -> (v_steps - 1) ->> 'friends')::integer, 999999) then
    insert into public.partners (user_id, status, commission_percent, decided_at)
    values (v_ref.referrer_id,
      case when coalesce((p ->> 'auto')::boolean, true) then 'active' else 'pending' end,
      least(greatest(coalesce((p ->> 'percent')::numeric, 3), 0), 50),
      case when coalesce((p ->> 'auto')::boolean, true) then now() end)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists referral_on_order_insert on public.orders;
create trigger referral_on_order_insert after insert on public.orders
  for each row execute function public._referral_on_order();
drop trigger if exists referral_on_order_status on public.orders;
create trigger referral_on_order_status after update of status on public.orders
  for each row execute function public._referral_on_order();

-- ---------- Mijoz uchun ----------
-- Hamkor balansi: tekshiruvdan oʻtgan komissiya − (toʻlangan + kutilayotgan soʻrovlar).
create or replace function public._partner_balance(p_partner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'earned', coalesce((select sum(amount) from public.partner_earnings where partner_id = p_partner and status = 'active'), 0),
    'holding', coalesce((select sum(amount) from public.partner_earnings where partner_id = p_partner and status = 'active' and available_at > now()), 0),
    'available_total', coalesce((select sum(amount) from public.partner_earnings where partner_id = p_partner and status = 'active' and available_at <= now()), 0),
    'paid', coalesce((select sum(amount) from public.partner_payouts where partner_id = p_partner and status = 'paid'), 0),
    'requested', coalesce((select sum(amount) from public.partner_payouts where partner_id = p_partner and status = 'requested'), 0)
  );
$$;

create or replace function public.my_referral()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public._referral_cfg();
  v_me public.profiles;
  v_partner public.partners;
  v_bal jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_me from public.profiles where id = v_uid;
  select * into v_partner from public.partners where user_id = v_uid;
  if found then v_bal := public._partner_balance(v_uid); end if;
  return jsonb_build_object(
    'enabled', coalesce((v_cfg ->> 'enabled')::boolean, false),
    'client_no', v_me.client_no,
    'qualify_on', v_cfg ->> 'qualify_on',
    'steps', v_cfg -> 'steps',
    'coupon_days', v_cfg -> 'coupon_days',
    'welcome', v_cfg -> 'welcome',
    'partner_cfg', jsonb_build_object('enabled', v_cfg #> '{partner,enabled}', 'percent', v_cfg #> '{partner,percent}',
      'min_payout', v_cfg #> '{partner,min_payout}', 'hold_days', v_cfg #> '{partner,hold_days}'),
    'qualified', (select count(*) from public.referrals where referrer_id = v_uid and status = 'qualified'),
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'name', coalesce(nullif(split_part(pf.full_name, ' ', 1), ''), 'Doʻst'),
        'status', r.status, 'created_at', r.created_at, 'qualified_at', r.qualified_at) order by r.created_at desc)
      from (select * from public.referrals where referrer_id = v_uid order by created_at desc limit 100) r
      left join public.profiles pf on pf.id = r.friend_id), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('step', rw.step, 'amount', rw.amount, 'created_at', rw.created_at) order by rw.step)
      from public.referral_rewards rw where rw.referrer_id = v_uid), '[]'::jsonb),
    'coupons', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.code, 'description', c.description, 'value', c.value, 'discount_type', c.discount_type,
        'min_order_amount', c.min_order_amount, 'ends_at', c.ends_at, 'design', c.design, 'source', c.source,
        'used', c.used_count >= coalesce(c.usage_limit, 1)) order by c.created_at desc)
      from public.coupons c where c.owner_id = v_uid and c.is_active
        and (c.ends_at is null or c.ends_at > now() - interval '30 days')), '[]'::jsonb),
    'referred_by', (select jsonb_build_object('name', coalesce(nullif(split_part(pf.full_name, ' ', 1), ''), 'Doʻst'))
      from public.profiles pf where pf.id = v_me.referred_by),
    'partner', case when v_partner.user_id is null then null else jsonb_build_object(
      'status', v_partner.status, 'percent', v_partner.commission_percent, 'card', v_partner.card, 'balance', v_bal,
      'payouts', coalesce((select jsonb_agg(jsonb_build_object('amount', po.amount, 'status', po.status, 'requested_at', po.requested_at) order by po.requested_at desc)
        from (select * from public.partner_payouts where partner_id = v_uid order by requested_at desc limit 20) po), '[]'::jsonb)
    ) end
  );
end;
$$;

-- Ulashish/nusxalash/koʻrish hisobi (kuniga koʻpi bilan 50 ta yozuv bir mijozdan).
create or replace function public.referral_track(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_kind not in ('share', 'copy', 'view') then return; end if;
  if (select count(*) from public.referral_events where user_id = auth.uid() and created_at > now() - interval '1 day') >= 50 then return; end if;
  insert into public.referral_events (user_id, kind) values (auth.uid(), p_kind);
end;
$$;

-- Hamkorlikka ariza (bosqichlarni tugatgan, avtomatik qabul oʻchirilgan boʻlsa).
create or replace function public.partner_apply()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public._referral_cfg();
  v_need integer;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not coalesce((v_cfg #>> '{partner,enabled}')::boolean, false) then raise exception 'PARTNER_DISABLED' using errcode = 'P0001'; end if;
  v_need := coalesce((v_cfg -> 'steps' -> (jsonb_array_length(v_cfg -> 'steps') - 1) ->> 'friends')::integer, 0);
  select count(*) into v_count from public.referrals where referrer_id = auth.uid() and status = 'qualified';
  if v_count < v_need then raise exception 'PARTNER_NOT_READY' using errcode = 'P0001'; end if;
  insert into public.partners (user_id, status, commission_percent)
  values (auth.uid(), 'pending', least(greatest(coalesce((v_cfg #>> '{partner,percent}')::numeric, 3), 0), 50))
  on conflict (user_id) do nothing;
  return (select status from public.partners where user_id = auth.uid());
end;
$$;

-- Pul yechish soʻrovi: faqat faol hamkor, minimal summadan katta va mavjud balansdan oshmaydi.
create or replace function public.partner_request_payout(p_amount bigint, p_card text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := public._referral_cfg();
  v_partner public.partners;
  v_bal jsonb;
  v_free bigint;
  v_id uuid;
  v_card text := nullif(regexp_replace(coalesce(p_card, ''), '[^0-9 ]', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_partner from public.partners where user_id = auth.uid() for update;
  if not found or v_partner.status <> 'active' then raise exception 'PARTNER_INACTIVE' using errcode = 'P0001'; end if;
  if exists (select 1 from public.partner_payouts where partner_id = auth.uid() and status = 'requested') then
    raise exception 'PAYOUT_PENDING' using errcode = 'P0001';
  end if;
  if v_card is null or length(replace(v_card, ' ', '')) < 16 or length(replace(v_card, ' ', '')) > 19 then
    raise exception 'PAYOUT_CARD' using errcode = 'P0001';
  end if;
  v_bal := public._partner_balance(auth.uid());
  v_free := (v_bal ->> 'available_total')::bigint - (v_bal ->> 'paid')::bigint - (v_bal ->> 'requested')::bigint;
  if p_amount is null or p_amount < coalesce((v_cfg #>> '{partner,min_payout}')::bigint, 0) or p_amount <= 0 then
    raise exception 'PAYOUT_MIN' using errcode = 'P0001';
  end if;
  if p_amount > v_free then raise exception 'PAYOUT_BALANCE' using errcode = 'P0001'; end if;
  update public.partners set card = left(v_card, 40), updated_at = now() where user_id = auth.uid();
  insert into public.partner_payouts (partner_id, amount, card) values (auth.uid(), p_amount, left(v_card, 40)) returning id into v_id;
  insert into public.notifications (user_id, type, title, body, link)
  values (null, 'payout', 'Hamkor pul yechishni soʻradi', p_amount || ' soʻm', '/admin/partners/payouts');
  return v_id;
end;
$$;

revoke all on function public._referral_cfg() from public, anon, authenticated;
revoke all on function public._issue_personal_coupon(uuid, bigint, bigint, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.referral_attach(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public._partner_balance(uuid) from public, anon, authenticated;
revoke all on function public._referral_on_order() from public, anon, authenticated;
revoke all on function public._coupon_owner_guard() from public, anon, authenticated;
revoke all on function public.my_referral() from public, anon;
revoke all on function public.referral_track(text) from public, anon;
revoke all on function public.partner_apply() from public, anon;
revoke all on function public.partner_request_payout(bigint, text) from public, anon;
grant execute on function public.my_referral() to authenticated;
grant execute on function public.referral_track(text) to authenticated;
grant execute on function public.partner_apply() to authenticated;
grant execute on function public.partner_request_payout(bigint, text) to authenticated;
grant execute on function public._referral_cfg() to service_role;
grant execute on function public._issue_personal_coupon(uuid, bigint, bigint, integer, text, text, uuid) to service_role;
grant execute on function public.referral_attach(uuid, bigint, text) to service_role;
grant execute on function public._partner_balance(uuid) to service_role;

-- ---------- Admin: hamkorlar reytingi va umumiy koʻrsatkichlar ----------
-- p_filter: partners (faol/muzlatilgan hamkorlar), zero (natijasiz hamkorlar), progress (hali hamkor emas,
-- lekin doʻst taklif qilgan), all (hammasi).
create or replace function public.admin_referral_board(p_filter text default 'partners', p_q text default '', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_rows jsonb;
  v_total integer;
  v_summary jsonb;
begin
  if not public.has_perm('partners.manage') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  with refs as (
    select r.referrer_id,
      count(*) as friends,
      count(*) filter (where r.status = 'qualified') as qualified
    from public.referrals r group by r.referrer_id
  ),
  sales as (
    select r.referrer_id, coalesce(sum(o.total), 0) as sales, count(o.id) as orders
    from public.referrals r join public.orders o on o.user_id = r.friend_id and o.status = 'delivered'
    group by r.referrer_id
  ),
  earn as (
    select partner_id,
      coalesce(sum(amount) filter (where status = 'active'), 0) as earned,
      coalesce(sum(amount) filter (where status = 'active' and available_at <= now()), 0) as available
    from public.partner_earnings group by partner_id
  ),
  pays as (
    select partner_id,
      coalesce(sum(amount) filter (where status = 'paid'), 0) as paid,
      coalesce(sum(amount) filter (where status = 'requested'), 0) as requested
    from public.partner_payouts group by partner_id
  ),
  base as (
    select pf.id as user_id, pf.client_no, pf.full_name, pf.phone, pt.status as partner_status, pt.commission_percent,
      coalesce(rf.friends, 0) as friends, coalesce(rf.qualified, 0) as qualified,
      coalesce(sl.sales, 0) as sales, coalesce(sl.orders, 0) as orders,
      coalesce(e.earned, 0) as earned, coalesce(e.available, 0) as available,
      coalesce(p.paid, 0) as paid, coalesce(p.requested, 0) as requested
    from public.profiles pf
    left join public.partners pt on pt.user_id = pf.id
    left join refs rf on rf.referrer_id = pf.id
    left join sales sl on sl.referrer_id = pf.id
    left join earn e on e.partner_id = pf.id
    left join pays p on p.partner_id = pf.id
    where (pt.user_id is not null or rf.referrer_id is not null)
  ),
  filtered as (
    select * from base b
    where case coalesce(p_filter, 'partners')
        when 'partners' then b.partner_status in ('active', 'frozen')
        when 'zero' then b.partner_status in ('active', 'frozen') and b.qualified = 0 and b.sales = 0
        when 'progress' then b.partner_status is null and b.friends > 0
        else true end
      and (v_q is null or b.full_name ilike '%' || v_q || '%' or b.phone ilike '%' || v_q || '%' or b.client_no::text = v_q)
  )
  select
    (select count(*) from filtered),
    coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from filtered order by sales desc, qualified desc, friends desc, client_no
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb)
  into v_total, v_rows;

  select jsonb_build_object(
    'partners', (select count(*) from public.partners where status in ('active', 'frozen')),
    'zero', (select count(*) from public.partners pt where pt.status in ('active', 'frozen')
      and not exists (select 1 from public.referrals r where r.referrer_id = pt.user_id and r.status = 'qualified')),
    'progress', (select count(distinct r.referrer_id) from public.referrals r
      where not exists (select 1 from public.partners pt where pt.user_id = r.referrer_id)),
    'applications', (select count(*) from public.partners where status = 'pending'),
    'sales', coalesce((select sum(o.total) from public.referrals r join public.partners pt on pt.user_id = r.referrer_id
      join public.orders o on o.user_id = r.friend_id and o.status = 'delivered'), 0),
    'sales_orders', coalesce((select count(o.id) from public.referrals r join public.partners pt on pt.user_id = r.referrer_id
      join public.orders o on o.user_id = r.friend_id and o.status = 'delivered'), 0),
    'commission', coalesce((select sum(amount) from public.partner_earnings where status = 'active'), 0),
    'holding', coalesce((select sum(amount) from public.partner_earnings where status = 'active' and available_at > now()), 0),
    'paid', coalesce((select sum(amount) from public.partner_payouts where status = 'paid'), 0),
    'debt', greatest(coalesce((select sum(amount) from public.partner_earnings where status = 'active' and available_at <= now()), 0)
      - coalesce((select sum(amount) from public.partner_payouts where status = 'paid'), 0), 0),
    'frozen', (select count(*) from public.partners where status = 'frozen'),
    'requests', (select count(*) from public.partner_payouts where status = 'requested'),
    'requests_sum', coalesce((select sum(amount) from public.partner_payouts where status = 'requested'), 0),
    'percent', public._referral_cfg() #> '{partner,percent}'
  ) into v_summary;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'summary', v_summary);
end;
$$;

-- ---------- Admin: Foydalanish (davr boʻyicha voronka va harakatlar) ----------
create or replace function public.admin_referral_usage(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if not public.has_perm('partners.manage') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select jsonb_build_object(
    'joined', (select count(*) from public.referrals where created_at >= p_from and created_at < p_to),
    'ordered', (select count(*) from public.referrals where created_at >= p_from and created_at < p_to and status in ('ordered', 'qualified')),
    'qualified', (select count(*) from public.referrals where created_at >= p_from and created_at < p_to and status = 'qualified'),
    'referrers', (select count(distinct referrer_id) from public.referrals where created_at >= p_from and created_at < p_to),
    'by_source', coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from public.referrals
      where created_at >= p_from and created_at < p_to group by source) s), '{}'::jsonb),
    'events', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.referral_events
      where created_at >= p_from and created_at < p_to group by kind) s), '{}'::jsonb),
    'users', (select count(distinct user_id) from public.referral_events where created_at >= p_from and created_at < p_to and kind in ('share', 'copy', 'view')),
    'coupons', coalesce((select jsonb_object_agg(source, jsonb_build_object('count', n, 'sum', s)) from (
      select source, count(*) n, coalesce(sum(value), 0) s from public.coupons
      where owner_id is not null and created_at >= p_from and created_at < p_to group by source) c), '{}'::jsonb),
    'redeemed', coalesce((select jsonb_build_object('count', count(*), 'sum', coalesce(sum(cr.amount), 0))
      from public.coupon_redemptions cr join public.coupons c on c.id = cr.coupon_id
      where c.owner_id is not null and cr.created_at >= p_from and cr.created_at < p_to), '{}'::jsonb),
    'sales', coalesce((select jsonb_build_object('count', count(*), 'sum', coalesce(sum(o.total), 0))
      from public.referrals r join public.orders o on o.user_id = r.friend_id
      where o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to), '{}'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'joined', n) order by d) from (
      select (created_at at time zone 'Asia/Tashkent')::date d, count(*) n from public.referrals
      where created_at >= p_from and created_at < p_to group by 1) s), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(to_jsonb(t)) from (
      select pf.client_no, pf.full_name, count(*) friends, count(*) filter (where r.status = 'qualified') qualified
      from public.referrals r join public.profiles pf on pf.id = r.referrer_id
      where r.created_at >= p_from and r.created_at < p_to
      group by pf.client_no, pf.full_name order by count(*) desc, pf.client_no limit 10) t), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.admin_referral_board(text, text, integer, integer) from public, anon;
revoke all on function public.admin_referral_usage(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_referral_board(text, text, integer, integer) to authenticated;
grant execute on function public.admin_referral_usage(timestamptz, timestamptz) to authenticated;
