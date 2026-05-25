-- Create CVs storage bucket
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

-- Owners can manage their CV files; admins can access all
create policy "Users read own cvs"
  on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid())));

create policy "Users upload own cvs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own cvs"
  on storage.objects for update to authenticated
  using (bucket_id = 'cvs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid())));

create policy "Users delete own cvs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid())));