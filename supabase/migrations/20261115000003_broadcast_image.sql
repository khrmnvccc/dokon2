-- =====================================================================
-- Ommaviy xabarga rasm (Laylak botidagidek: rasm + matn + tugma).
-- Idempotent: faqat ustun qoʻshadi, mavjud maʼlumot oʻchirilmaydi.
-- =====================================================================

insert into public.app_meta (key, value) values ('schema_version', '"20261115000003"')
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.broadcasts add column if not exists image text;

do $$ begin
  alter table public.broadcasts add constraint broadcasts_image_https
    check (image is null or (image ~ '^https://' and char_length(image) <= 500));
exception when duplicate_object then null; end $$;
