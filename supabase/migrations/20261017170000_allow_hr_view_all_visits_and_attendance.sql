-- Migration: Allow Human Resources (HR) and Admin roles to view and manage all users' outlet visits and attendance
-- Safe in-place update with NO DROP FUNCTION commands (preserves all dependent RLS policies).

-- 1. Update public.is_admin() in place to include HR and executive roles
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    left join public.user_roles ur on ur.id = s.assigned_role
    where (
      s.auth_user_id = auth.uid()
      or (auth.uid() is not null and lower(s.email) = lower(auth.jwt()->>'email'))
      or (auth.uid() is not null and lower(s.email) = lower((select email from auth.users where id = auth.uid())))
    )
      and s.is_active = true
      and (
        ur.key in ('administrator', 'admin', 'hr', 'national_sales_manager', 'nsm')
        or lower(ur.name) like '%admin%'
        or lower(ur.name) like '%human resource%'
        or lower(ur.name) like '%hr%'
        or ur.can_manage_staff = true
        or ur.can_view_all_sales = true
        or ur.hierarchy_level in (1, 2)
        or s.role in (1, 2, 3)
        or s.assigned_role = '21d906a9-2842-4f97-a7ca-7345ee70432a'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000001'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000002'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000003'
      )
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- 2. Create or replace can_manage_visits(uuid)
create or replace function public.can_manage_visits(p_auth_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    left join public.user_roles ur on ur.id = s.assigned_role
    where (
      s.auth_user_id = p_auth_id
      or (p_auth_id is not null and lower(s.email) = lower(auth.jwt()->>'email'))
      or (p_auth_id is not null and lower(s.email) = lower((select email from auth.users where id = p_auth_id)))
    )
      and s.is_active = true
      and (
        ur.key in ('administrator', 'admin', 'hr', 'national_sales_manager', 'nsm')
        or lower(ur.name) like '%admin%'
        or lower(ur.name) like '%human resource%'
        or lower(ur.name) like '%hr%'
        or ur.can_manage_staff = true
        or ur.can_view_all_sales = true
        or ur.hierarchy_level in (1, 2)
        or s.role in (1, 2, 3)
        or s.assigned_role = '21d906a9-2842-4f97-a7ca-7345ee70432a'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000001'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000002'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000003'
      )
  );
$$;

grant execute on function public.can_manage_visits(uuid) to authenticated, anon;

-- 3. Update SELECT RLS policy on public.visits to allow HR and Admins to view all visits & attendance
alter table public.visits enable row level security;

drop policy if exists "Staff can view own visits" on public.visits;
drop policy if exists "Staff, administrators and hr can view visits" on public.visits;

create policy "Staff, administrators and hr can view visits"
on public.visits
for select
to authenticated
using (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
  or public.can_manage_visits(auth.uid())
  or exists (
    select 1
    from public.staff s
    left join public.user_roles ur on ur.id = s.assigned_role
    where (
      s.auth_user_id = auth.uid()
      or (auth.uid() is not null and lower(s.email) = lower(auth.jwt()->>'email'))
    )
      and s.is_active = true
      and (
        ur.key in ('administrator', 'admin', 'hr', 'national_sales_manager', 'nsm')
        or lower(ur.name) like '%admin%'
        or lower(ur.name) like '%human resource%'
        or lower(ur.name) like '%hr%'
        or ur.can_view_all_sales = true
        or ur.can_manage_staff = true
        or ur.hierarchy_level in (1, 2)
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000002'
      )
  )
);

-- 4. Update UPDATE RLS policy on public.visits
drop policy if exists "Staff can update own visits" on public.visits;
drop policy if exists "Staff and administrators can update visits" on public.visits;
drop policy if exists "Staff, administrators and hr can update visits" on public.visits;

create policy "Staff, administrators and hr can update visits"
on public.visits
for update
to authenticated
using (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
  or public.can_manage_visits(auth.uid())
)
with check (true);

-- 5. Update DELETE RLS policy on public.visits to allow Admin and HR
drop policy if exists "Administrators can delete visits" on public.visits;
drop policy if exists "Administrators and hr can delete visits" on public.visits;

create policy "Administrators and hr can delete visits"
on public.visits
for delete
to authenticated
using (
  public.can_manage_visits(auth.uid())
);
