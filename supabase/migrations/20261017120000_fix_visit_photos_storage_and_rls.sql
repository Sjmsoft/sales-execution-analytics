-- Migration: Fix visit-photos storage bucket access and RLS
-- Ensures administrators, managers, and staff can all upload and view visit evidence photos.

-- 1. Ensure the 'visit-photos' bucket exists and is set to PUBLIC
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do update set public = true;

-- 2. Drop existing restrictive policies on storage.objects for visit-photos
drop policy if exists "Staff can upload their visit photos" on storage.objects;
drop policy if exists "Staff can read their visit photos" on storage.objects;
drop policy if exists "Public access to visit photos" on storage.objects;
drop policy if exists "Allow authenticated upload to visit-photos" on storage.objects;
drop policy if exists "Allow all read to visit-photos" on storage.objects;
drop policy if exists "Allow all upload to visit-photos" on storage.objects;

-- 3. Allow SELECT for everyone (authenticated, anon, admins) so visit photos can be viewed in tables & audits
create policy "Allow all read to visit-photos"
on storage.objects for select
using (bucket_id = 'visit-photos');

-- 4. Allow INSERT for authenticated and anon users so field reps can upload check-out photos
create policy "Allow all upload to visit-photos"
on storage.objects for insert
with check (bucket_id = 'visit-photos');

-- 5. Allow UPDATE and DELETE for authenticated users (admins / staff updating photos)
create policy "Allow all update to visit-photos"
on storage.objects for update
using (bucket_id = 'visit-photos')
with check (bucket_id = 'visit-photos');

create policy "Allow all delete to visit-photos"
on storage.objects for delete
using (bucket_id = 'visit-photos');
