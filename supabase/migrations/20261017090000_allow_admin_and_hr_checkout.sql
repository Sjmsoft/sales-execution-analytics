-- Migration: Allow Admin and HR roles to manage and check-out visits / attendance sessions
-- This allows administrators and HR personnel to check out users who are unable to check out themselves.

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
        ur.key in ('administrator', 'admin', 'hr')
        or ur.can_manage_staff = true
        or ur.hierarchy_level = 1
        or s.role = 1
        or s.assigned_role = '21d906a9-2842-4f97-a7ca-7345ee70432a'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000001'
      )
  );
$$;

grant execute on function public.can_manage_visits(uuid) to authenticated, anon;

-- Update RLS policy on public.visits for update
drop policy if exists "Staff and administrators can update visits" on public.visits;
drop policy if exists "Staff, administrators and hr can update visits" on public.visits;

create policy "Staff, administrators and hr can update visits"
on public.visits for update to authenticated
using (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
  or public.can_manage_visits(auth.uid())
)
with check (true);
