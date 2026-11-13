-- =====================================================================
-- Aksiya va promo-kod dizaynlari (kupon kartasi), saytdagi ochiq kuponlar.
-- Idempotent: faqat ustun va funksiya qoʻshadi, mavjud maʼlumot oʻchirilmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261114000001"')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Kupon kartasining koʻrinishi: rang toʻplami va qisqa yozuv (masalan "11.11").
alter table public.promotions add column if not exists design jsonb not null default '{}'::jsonb;
alter table public.coupons    add column if not exists design jsonb not null default '{}'::jsonb;
-- Promo-kod saytdagi “Kuponlar” boʻlimida koʻrinadimi (standart: yoʻq, kod sir boʻlib qoladi).
alter table public.coupons    add column if not exists is_public boolean not null default false;

do $$ begin
  alter table public.promotions add constraint promotions_design_obj check (jsonb_typeof(design) = 'object');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.coupons add constraint coupons_design_obj check (jsonb_typeof(design) = 'object');
exception when duplicate_object then null; end $$;

-- Saytdagi ochiq kuponlar. coupons jadvali anon uchun yopiq (kodlar sir), shuning uchun
-- faqat Ega “saytda koʻrsatish”ni yoqqan, hozir amaldagi va limiti tugamagan kuponlar
-- kerakli ustunlari bilan qaytariladi.
create or replace function public.public_coupons()
returns table (
  id uuid, code text, description text, discount_type public.discount_type, value bigint,
  max_discount bigint, min_order_amount bigint, ends_at timestamptz, design jsonb
)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.description, c.discount_type, c.value, c.max_discount, c.min_order_amount, c.ends_at, c.design
  from public.coupons c
  where c.is_public and c.is_active
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at > now())
    and (c.usage_limit is null or c.used_count < c.usage_limit)
  order by c.created_at desc
  limit 20;
$$;
revoke all on function public.public_coupons() from public;
grant execute on function public.public_coupons() to anon, authenticated;
