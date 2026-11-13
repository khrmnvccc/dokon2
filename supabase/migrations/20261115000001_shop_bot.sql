-- =====================================================================
-- Doʻkon boti (xaridorlar uchun alohida Telegram bot) va Telegram mini-ilova orqali kirish.
-- Idempotent: faqat ustun va indeks qoʻshadi, mavjud maʼlumot oʻchirilmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261115000001"')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Xaridor qaysi botga /start bosgan: eski (admin) bot yoki yangi doʻkon boti.
-- Bot faqat oʻziga yozgan odamga xabar yubora oladi, shuning uchun ommaviy xabar shu bot orqali ketadi.
alter table public.telegram_subscribers add column if not exists via text not null default 'admin';
alter table public.telegram_subscribers add column if not exists last_seen timestamptz;
do $$ begin
  alter table public.telegram_subscribers add constraint telegram_subscribers_via check (via in ('admin', 'shop'));
exception when duplicate_object then null; end $$;
create index if not exists telegram_subscribers_user_idx on public.telegram_subscribers (user_id);

-- Maxfiy jadval yopiqligicha qoladi.
revoke all on public.telegram_subscribers from anon, authenticated;
