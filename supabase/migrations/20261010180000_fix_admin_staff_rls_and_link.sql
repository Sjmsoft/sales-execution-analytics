-- Migration: Fix admin staff RLS policy, resolve is_admin overloading, and link staff auth_user_id
-- Description:
-- 1. Drops overloaded versions of public.is_admin() to fix PGRST203 ambiguity.
-- 2. Creates a robust security-definer is_admin(p_auth_id) function that recognizes admins
--    by auth_user_id, email from auth token/auth.users, or assigned administrator role.
-- 3. Updates staff RLS policies to allow administrators to insert/update/delete staff,
--    and allows users to link their own staff record by email.
-- 4. Creates security-definer RPC function link_current_user_staff() to safely link auth_user_id.
-- 5. Auto-links existing staff rows to auth.users and guarantees administrator role assignment.

-- 1. Drop existing overloaded functions
drop function if exists public.is_admin();
drop function if exists public.is_admin(uuid);

-- 2. Define robust is_admin function
create or replace function public.is_admin(p_auth_id uuid default auth.uid())
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
        ur.key = 'administrator'
        or ur.can_manage_staff = true
        or s.role = 1
        or s.assigned_role = '21d906a9-2842-4f97-a7ca-7345ee70432a'
        or s.assigned_role = 'a0000000-0000-4000-8000-000000000001'
      )
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;

-- 3. Security definer RPC to safely link the current logged-in user to their staff record
create or replace function public.link_current_user_staff()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt()->>'email';
  v_count int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Not authenticated');
  end if;

  if v_email is null then
    select email into v_email from auth.users where id = v_uid;
  end if;

  if v_email is null then
    return jsonb_build_object('success', false, 'message', 'No email found for authenticated user');
  end if;

  update public.staff
  set auth_user_id = v_uid
  where lower(email) = lower(v_email)
    and (auth_user_id is null or auth_user_id != v_uid);

  get diagnostics v_count = row_count;

  return jsonb_build_object('success', true, 'updated', v_count);
end;
$$;

grant execute on function public.link_current_user_staff() to authenticated;

-- 4. Clean up and establish Staff RLS Policies
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
    or lower(email) = lower(auth.jwt()->>'email')
  )
  with check (true);

drop policy if exists "Administrators can delete staff" on public.staff;
create policy "Administrators can delete staff"
  on public.staff for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- 5. Auto-link all existing staff records to auth.users by email
update public.staff s
set auth_user_id = u.id
from auth.users u
where lower(s.email) = lower(u.email)
  and (s.auth_user_id is null or s.auth_user_id != u.id);

-- 6. Guarantee msomjohn@gmail.com has Administrator role & link if existing
update public.staff s
set assigned_role = coalesce(
      (select id from public.user_roles where key = 'administrator'),
      '21d906a9-2842-4f97-a7ca-7345ee70432a'::uuid
    ),
    role = 1,
    is_active = true,
    auth_user_id = coalesce(s.auth_user_id, u.id)
from auth.users u
where lower(u.email) = lower(s.email)
  and lower(s.email) = lower('msomjohn@gmail.com');

-- 7. Trigger to automatically sync auth_user_id whenever staff is inserted or updated
create or replace function public.sync_staff_auth_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auth_user_id is null and new.email is not null then
    select id into new.auth_user_id
    from auth.users
    where lower(email) = lower(new.email)
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_staff_auth_user_id on public.staff;
create trigger trg_sync_staff_auth_user_id
before insert or update on public.staff
for each row
execute function public.sync_staff_auth_user_id();
