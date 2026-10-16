-- Migration: User management roles and staff synchronization
-- Supports role hierarchy and staff management directly in Supabase tables.

-- 1. Ensure user_roles table exists
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  hierarchy_level int not null default 5,
  sort_order int not null default 5, -- Added sort_order
  can_manage_staff boolean not null default false,
  can_assign_targets boolean not null default false,
  can_view_all_sales boolean not null default false,
  description text,
  created_at timestamptz default now()
);

-- 1b. If user_roles already existed with an older shape, add any missing columns
alter table public.user_roles
  add column if not exists hierarchy_level int not null default 5,
  add column if not exists sort_order int not null default 5, -- Added sort_order
  add column if not exists can_manage_staff boolean not null default false,
  add column if not exists can_assign_targets boolean not null default false,
  add column if not exists can_view_all_sales boolean not null default false,
  add column if not exists description text,
  add column if not exists created_at timestamptz default now();

create unique index if not exists user_roles_key_key_idx on public.user_roles(key);
alter table public.user_roles
  alter column created_at set default now();

-- 2. Populate / Upsert system roles
-- Added sort_order to the column list and provided sequential values (1-7) in the values block
insert into public.user_roles (id, key, name, hierarchy_level, sort_order, can_manage_staff, can_assign_targets, can_view_all_sales, description)
values
  ('a0000000-0000-4000-8000-000000000001', 'administrator', 'Administrator', 1, 1, true, true, true, 'Full system administration, settings, security, and global configuration.'),
  ('a0000000-0000-4000-8000-000000000002', 'hr', 'Human Resources (HR)', 2, 2, true, false, true, 'Sees all staff activities, attendance, audit history, and reporting chains like the NSM.'),
  ('a0000000-0000-4000-8000-000000000003', 'national_sales_manager', 'National Sales Manager (NSM)', 2, 3, true, true, true, 'Overall sales lead. Sees activities, targets, and sales of all regional managers and field reps.'),
  ('a0000000-0000-4000-8000-000000000004', 'regional_sales_manager', 'Regional Sales Manager (RSM)', 3, 4, true, true, false, 'Oversees sales operations across an assigned region, managing SEs, BAs, and VSRs.'),
  ('a0000000-0000-4000-8000-000000000005', 'sales_executive', 'Sales Executive (SE)', 4, 5, true, true, false, 'Executes sales and directly supervises Brand Ambassadors and VSRs within their territory.'),
  ('a0000000-0000-4000-8000-000000000006', 'brand_ambassador', 'Brand Ambassador (BA)', 5, 6, false, false, false, 'Field representative executing on-trade sales (bottles only) under SE or RSM supervision.'),
  ('a0000000-0000-4000-8000-000000000007', 'vsr', 'Van Sales Rep (VSR)', 5, 7, false, false, false, 'Mobile distributor recording bottle & case sales across retail accounts in their assigned region.')
on conflict (key) do update set
  name = excluded.name,
  hierarchy_level = excluded.hierarchy_level,
  sort_order = excluded.sort_order,
  can_manage_staff = excluded.can_manage_staff,
  can_assign_targets = excluded.can_assign_targets,
  can_view_all_sales = excluded.can_view_all_sales,
  description = excluded.description;

-- 3. Enhance public.staff with hierarchy and regional attributes if not present
alter table public.staff
  add column if not exists reports_to uuid references public.staff(id) on delete set null,
  add column if not exists assigned_regions text[] default array[]::text[],
  add column if not exists avatar_url text;

-- 4. Security definer helper function to prevent RLS recursion
create or replace function public.is_admin(p_auth_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    join public.user_roles ur on ur.id = s.assigned_role
    where s.auth_user_id = p_auth_id
      and s.is_active = true
      and (ur.key = 'administrator' or ur.can_manage_staff = true)
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;

-- Enable RLS and setup policies
alter table public.user_roles enable row level security;
alter table public.staff enable row level security;

-- Read policies: Allow all authenticated and anonymous to view roles and active staff
drop policy if exists "Allow reading user_roles" on public.user_roles;
create policy "Allow reading user_roles"
  on public.user_roles for select
  using (true);

drop policy if exists "Allow reading staff" on public.staff;
create policy "Allow reading staff"
  on public.staff for select
  using (true);

-- Insert/Update/Delete policies for staff:
drop policy if exists "Administrators can insert staff" on public.staff;
create policy "Administrators can insert staff"
  on public.staff for insert
  to authenticated
  with check (
    public.is_admin(auth.uid())
    or not exists (select 1 from public.staff)
  );

drop policy if exists "Administrators can update staff" on public.staff;
create policy "Administrators can update staff"
  on public.staff for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or auth_user_id = auth.uid()
  )
  with check (true);

drop policy if exists "Administrators can delete staff" on public.staff;
create policy "Administrators can delete staff"
  on public.staff for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- Also allow administrators to manage user_roles if customized
drop policy if exists "Administrators can manage user_roles" on public.user_roles;
create policy "Administrators can manage user_roles"
  on public.user_roles for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 5. Bootstrap: give your own login the Administrator role.
-- Without this, the staff insert/update policies above will block you from creating users.
-- Replace the email below (both places) with the email you log in with.
-- 5. Bootstrap: give your own login the Administrator role.
insert into public.staff (id, auth_user_id, name, email, assigned_role, is_active)
select gen_random_uuid(), u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), u.email,
       (select id from public.user_roles where key = 'administrator'), true
from auth.users u
where lower(u.email) = lower('msomjohn@gmail.com')
  and not exists (
    select 1 from public.staff s
    where s.auth_user_id = u.id or lower(s.email) = lower(u.email)
  );

update public.staff s
set assigned_role = (select id from public.user_roles where key = 'administrator'),
    is_active = true,
    auth_user_id = coalesce(s.auth_user_id, u.id)
from auth.users u
where lower(u.email) = lower('msomjohn@gmail.com')
  and (s.auth_user_id = u.id or lower(s.email) = lower(u.email));