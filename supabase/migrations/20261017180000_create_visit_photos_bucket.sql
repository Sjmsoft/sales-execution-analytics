-- Migration: Create visit-photos storage bucket and enable public read / upload access
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do update set public = true;

-- Drop previous conflicting policies on storage.objects for visit-photos
drop policy if exists "Staff can upload their visit photos" on storage.objects;
drop policy if exists "Staff can read their visit photos" on storage.objects;
drop policy if exists "Public access to visit photos" on storage.objects;
drop policy if exists "Allow authenticated upload to visit-photos" on storage.objects;
drop policy if exists "Allow all read to visit-photos" on storage.objects;
drop policy if exists "Allow all upload to visit-photos" on storage.objects;
drop policy if exists "Allow all update to visit-photos" on storage.objects;
drop policy if exists "Allow all delete to visit-photos" on storage.objects;

-- Allow SELECT for everyone so photos load in tables and lightboxes
create policy "Allow all read to visit-photos"
on storage.objects for select
using (bucket_id = 'visit-photos');

-- Allow INSERT for everyone (field reps uploading check-out evidence)
create policy "Allow all upload to visit-photos"
on storage.objects for insert
with check (bucket_id = 'visit-photos');

-- Allow UPDATE for authenticated users
create policy "Allow all update to visit-photos"
on storage.objects for update
using (bucket_id = 'visit-photos')
with check (bucket_id = 'visit-photos');

-- Allow DELETE for authenticated users
create policy "Allow all delete to visit-photos"
on storage.objects for delete
using (bucket_id = 'visit-photos');
