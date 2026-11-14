-- =====================================================================
-- Mijozlar doʻkon botiga yozgan xabarlari (murojaatlar) va doʻkon javoblari.
-- Faqat server (service role) oʻqiydi/yozadi; admin panel ruxsatni server tomonda tekshiradi.
-- Idempotent: faqat yangi jadval, mavjud maʼlumot oʻzgarmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261116000005"')
on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  user_id uuid references auth.users (id) on delete set null,
  direction text not null check (direction in ('in', 'out')),
  text text check (char_length(text) <= 4096),
  photo_file_id text check (char_length(photo_file_id) <= 300),
  tg_message_id bigint,
  sent_by uuid references auth.users (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_chat_idx on public.support_messages (chat_id, created_at desc);
create index if not exists support_messages_unread_idx on public.support_messages (created_at desc) where direction = 'in' and read_at is null;
alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon, authenticated;
grant all on public.support_messages to service_role;
