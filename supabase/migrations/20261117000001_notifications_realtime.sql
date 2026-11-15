-- Saytdagi qoʻngʻiroqcha: yangi bildirishnoma darhol kelishi uchun Realtime'ga qoʻshamiz.
-- RLS amal qiladi: har kim faqat oʻz xabarini oladi. Idempotent, hech narsa oʻchirilmaydi.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create index if not exists notifications_unread_idx on public.notifications (user_id) where not is_read;
