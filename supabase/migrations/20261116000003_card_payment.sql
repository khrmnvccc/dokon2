-- =====================================================================
-- Kartaga oʻtkazma (P2P) va chek:
--  • Ega toʻlov usuliga karta raqamini kiritadi (payment_methods.card) — mijozga karta koʻrinishida chiqadi.
--  • Mijoz chek rasmini yuklaydi (yopiq “receipts” bucket, faqat server yozadi/oʻqiydi) → payment_receipts.
--  • Xodim chekni tasdiqlaydi yoki rad etadi (admin_review_receipt). Tasdiqlanmaguncha buyurtmani
--    “Yoʻlda”/“Yetkazildi” ga oʻtkazib boʻlmaydi.
-- Idempotent: faqat yangi ustun/jadval/funksiya qoʻshiladi, mavjud maʼlumot oʻzgarmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261116000003"')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Karta: { number, holder, bank, theme }. Faqat “bank_transfer” turida ishlatiladi.
alter table public.payment_methods add column if not exists card jsonb;

-- Chek rasmlari uchun yopiq bucket (siyosat yoʻq — faqat service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  path text not null check (char_length(path) <= 300),
  mime text not null,
  size integer not null check (size > 0),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  note text check (char_length(note) <= 500),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);
create index if not exists payment_receipts_order_idx on public.payment_receipts (order_id, created_at desc);
create index if not exists payment_receipts_pending_idx on public.payment_receipts (created_at desc) where status = 'submitted';

alter table public.payment_receipts enable row level security;
revoke all on public.payment_receipts from anon;
grant select on public.payment_receipts to authenticated;
grant all on public.payment_receipts to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_receipts' and policyname = 'dk_payment_receipts_staff') then
    create policy dk_payment_receipts_staff on public.payment_receipts for select to authenticated
      using ((select public.has_perm('orders.read')));
  end if;
end $$;

-- Kartaga toʻlov tasdiqlanmaguncha joʻnatib boʻlmaydi.
create or replace function public._require_card_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('shipped', 'delivered') and new.status is distinct from old.status
     and new.payment_status <> 'paid'
     and exists (select 1 from public.payment_methods pm
                 where pm.id = new.payment_method_id and pm.kind = 'bank_transfer' and pm.card is not null) then
    raise exception 'PAYMENT_NOT_CONFIRMED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create or replace trigger require_card_payment before update of status on public.orders
  for each row execute function public._require_card_payment();

-- Xodim: chekni tasdiqlash (buyurtma “Toʻlangan” boʻladi) yoki rad etish (mijoz qayta yuklaydi).
create or replace function public.admin_review_receipt(p_receipt uuid, p_approve boolean, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare r public.payment_receipts; v_order public.orders;
begin
  if not public.has_perm('orders.write') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into r from public.payment_receipts where id = p_receipt for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if r.status <> 'submitted' then raise exception 'RECEIPT_DECIDED' using errcode = 'P0001'; end if;
  if not p_approve and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_order from public.orders where id = r.order_id for update;

  update public.payment_receipts
  set status = case when p_approve then 'approved' else 'rejected' end,
      note = left(nullif(trim(coalesce(p_note, '')), ''), 500), decided_at = now(), decided_by = auth.uid()
  where id = p_receipt;

  if p_approve then
    update public.orders set payment_status = 'paid', updated_at = now() where id = r.order_id;
    -- Shu buyurtmaning boshqa kutilayotgan cheklari ham yopiladi
    update public.payment_receipts set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where order_id = r.order_id and status = 'submitted';
  end if;

  if v_order.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_order.user_id, 'payment',
      case when p_approve then 'Toʻlovingiz tasdiqlandi' else 'Chek qabul qilinmadi' end,
      case when p_approve then 'Buyurtma №' || v_order.number || ' — tez orada joʻnatamiz'
           else 'Buyurtma №' || v_order.number || ': ' || left(trim(p_note), 200) || '. Chekni qayta yuklang' end,
      '/account/orders/' || v_order.id);
  end if;
  return r.order_id;
end;
$$;
revoke all on function public._require_card_payment() from public, anon, authenticated;
revoke all on function public.admin_review_receipt(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_receipt(uuid, boolean, text) to authenticated;
