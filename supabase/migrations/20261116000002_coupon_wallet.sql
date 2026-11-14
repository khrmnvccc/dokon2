-- =====================================================================
-- Mijozning kupon hamyoni (“Kuponlarim”):
--  • hammaga ochiq kuponlar — hali boshlanmaganlari ham (60 kun ichida boshlansa, “… dan” deb koʻrinadi);
--  • botda shu mijozga yuborilgan kuponlar (ochiq boʻlmasa ham) — coupon_sends jadvalida qayd qilinadi.
-- Idempotent: faqat yangi jadval va funksiya qoʻshiladi, mavjud maʼlumot oʻzgarmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261116000002"')
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.coupon_sends (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
create index if not exists coupon_sends_user_idx on public.coupon_sends (user_id, sent_at desc);
alter table public.coupon_sends enable row level security;
-- Faqat server (bot yuborganda) yozadi va oʻqiydi; mijoz faqat my_coupon_wallet() orqali koʻradi.
revoke all on public.coupon_sends from anon, authenticated;
grant all on public.coupon_sends to service_role;

create or replace function public.my_coupon_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.code, 'description', c.description, 'discount_type', c.discount_type,
        'value', c.value, 'max_discount', c.max_discount, 'min_order_amount', c.min_order_amount,
        'starts_at', c.starts_at, 'ends_at', c.ends_at, 'design', c.design,
        'sent', s.coupon_id is not null,
        'used', c.per_user_limit is not null and (
          select count(*) from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = v_uid) >= c.per_user_limit
      ) order by (c.starts_at is not null and c.starts_at > now()), s.sent_at desc nulls last, c.created_at desc)
    from public.coupons c
    left join public.coupon_sends s on s.coupon_id = c.id and s.user_id = v_uid
    where c.owner_id is null
      and c.is_active
      and (c.is_public or s.coupon_id is not null)
      and (c.ends_at is null or c.ends_at > now())
      and (c.starts_at is null or c.starts_at <= now() + interval '60 days')
      and (c.usage_limit is null or c.used_count < c.usage_limit)
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.my_coupon_wallet() from public, anon;
grant execute on function public.my_coupon_wallet() to authenticated;
