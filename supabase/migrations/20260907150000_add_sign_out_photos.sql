alter table public.visits add column if not exists sign_out_photo_url text;

insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

drop policy if exists "Staff can upload their visit photos" on storage.objects;
create policy "Staff can upload their visit photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'visit-photos');

drop policy if exists "Staff can read their visit photos" on storage.objects;
create policy "Staff can read their visit photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'visit-photos'
  and exists (
    select 1 from public.visits
    where public.visits.id::text = (storage.foldername(storage.objects.name))[1]
      and public.visits.staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
  )
);
