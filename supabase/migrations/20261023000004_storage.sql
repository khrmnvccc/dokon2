-- =====================================================================
-- Do'kon: Supabase Storage (rasmlar uchun "media" bucket)
-- SVG ruxsat etilmaydi (XSS xavfi). Hajm: 5 MB gacha.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


create policy dk_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy dk_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.has_perm('media.write')));
create policy dk_media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.has_perm('media.write')))
  with check (bucket_id = 'media' and (select public.has_perm('media.write')));
create policy dk_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.has_perm('media.write')));
