-- =====================================================================
-- 1) Kartaga toʻlov: buyurtma toʻlov tasdiqlangandan keyingina “Tasdiqlandi” boʻladi.
--    Chek tasdiqlanganda yangi buyurtma oʻzi “Tasdiqlandi” ga oʻtadi.
-- 2) Sharhga doʻkon javobi (reply, replied_at) — faqat xodim yozadi.
-- Idempotent: faqat yangi ustun va funksiyalar (create or replace), mavjud maʼlumot oʻzgarmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261116000004"')
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public._require_card_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'processing', 'shipped', 'delivered') and new.status is distinct from old.status
     and new.payment_status <> 'paid'
     and exists (select 1 from public.payment_methods pm
                 where pm.id = new.payment_method_id and pm.kind = 'bank_transfer' and pm.card is not null) then
    raise exception 'PAYMENT_NOT_CONFIRMED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

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
    -- Yangi buyurtma toʻlov bilan birga tasdiqlanadi
    if v_order.status = 'new' then
      update public.orders set status = 'confirmed', confirmed_at = now() where id = r.order_id;
      insert into public.order_status_history (order_id, status, note, changed_by)
      values (r.order_id, 'confirmed', 'Toʻlov tasdiqlandi', auth.uid());
    end if;
    update public.payment_receipts set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where order_id = r.order_id and status = 'submitted';
  end if;

  if v_order.user_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_order.user_id, 'payment',
      case when p_approve then 'Toʻlovingiz tasdiqlandi' else 'Chek qabul qilinmadi' end,
      case when p_approve then 'Buyurtma №' || v_order.number || ' tasdiqlandi — tez orada joʻnatamiz'
           else 'Buyurtma №' || v_order.number || ': ' || left(trim(p_note), 200) || '. Chekni qayta yuklang' end,
      '/account/orders/' || v_order.id);
  end if;
  return r.order_id;
end;
$$;
revoke all on function public._require_card_payment() from public, anon, authenticated;
revoke all on function public.admin_review_receipt(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_receipt(uuid, boolean, text) to authenticated;

-- ---------- Sharhga javob ----------
alter table public.reviews add column if not exists reply text check (char_length(reply) <= 2000);
alter table public.reviews add column if not exists replied_at timestamptz;

-- Mijoz oʻz sharhiga “javob” yozib qoʻya olmasin: javobni faqat moderator oʻzgartiradi.
create or replace function public._review_reply_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.has_perm('reviews.moderate') then
    if tg_op = 'INSERT' then
      new.reply := null; new.replied_at := null;
    else
      new.reply := old.reply; new.replied_at := old.replied_at;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public._review_reply_guard() from public, anon, authenticated;
create or replace trigger review_reply_guard before insert or update on public.reviews
  for each row execute function public._review_reply_guard();
