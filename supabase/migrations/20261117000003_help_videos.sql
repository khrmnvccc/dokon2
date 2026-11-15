-- Yordam markazi videolari (Sozlamalar → Yordam markazi): ochiq bucket, faqat sozlamalarni oʻzgartira oladigan xodim yuklaydi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('help-videos', 'help-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'dk_help_videos_read') then
    create policy dk_help_videos_read on storage.objects for select to anon, authenticated using (bucket_id = 'help-videos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'dk_help_videos_insert') then
    create policy dk_help_videos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'help-videos' and (select public.has_perm('settings.write')));
  end if;
end $$;
