-- Migration: Fix infinite recursion in user_roles and staff RLS policies
-- Uses SECURITY DEFINER function to evaluate admin status without recursive RLS checks.

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

-- Grant execution to authenticated & anon roles
grant execute on function public.is_admin(uuid) to authenticated, anon;

-- Re-apply user_roles RLS policies cleanly
alter table public.user_roles enable row level security;

drop policy if exists "Allow reading user_roles" on public.user_roles;
create policy "Allow reading user_roles"
  on public.user_roles for select
  using (true);

drop policy if exists "Administrators can manage user_roles" on public.user_roles;
create policy "Administrators can manage user_roles"
  on public.user_roles for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Re-apply staff RLS policies cleanly
alter table public.staff enable row level security;

drop policy if exists "Allow reading staff" on public.staff;
create policy "Allow reading staff"
  on public.staff for select
  using (true);

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

-- Drop NOT NULL constraint on legacy 'role' column if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff'
      and column_name = 'role'
  ) then
    alter table public.staff alter column role drop not null;
    alter table public.staff alter column role set default 5;
  end if;
end $$;
