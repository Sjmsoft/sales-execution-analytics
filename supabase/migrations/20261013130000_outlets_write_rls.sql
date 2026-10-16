-- Migration: Allow outlets to be created and edited by signed-in staff.
--
-- Root cause: public.outlets has RLS enabled but only SELECT (all authenticated)
-- and DELETE (administrators) policies were ever defined. With no INSERT or UPDATE
-- policy, Postgres rejects every insert ("new row violates row-level security
-- policy for table outlets") and silently filters every update to 0 rows.
-- The frontend swallowed those errors and kept the outlet only in localStorage.

alter table public.outlets enable row level security;

-- Convert outlets columns (outlet_type, region_id, assigned_manager) to TEXT so that
-- custom outlet types, region names (e.g. 'Edo Region'), and staff identifiers
-- can be saved without Postgres integer or UUID type syntax errors.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'outlets'
      and column_name = 'outlet_type'
      and data_type != 'text'
  ) then
    alter table public.outlets alter column outlet_type type text using outlet_type::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'outlets'
      and column_name = 'region_id'
      and data_type != 'text'
  ) then
    alter table public.outlets alter column region_id type text using region_id::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'outlets'
      and column_name = 'assigned_manager'
      and data_type != 'text'
  ) then
    alter table public.outlets alter column assigned_manager type text using assigned_manager::text;
  end if;
end $$;

grant select, insert, update on public.outlets to authenticated;

-- Any active staff member (field reps register new outlets) or an administrator.
drop policy if exists "Active staff can create outlets" on public.outlets;
create policy "Active staff can create outlets"
on public.outlets
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.staff
    where public.staff.auth_user_id = auth.uid()
      and public.staff.is_active = true
  )
);

drop policy if exists "Active staff can update outlets" on public.outlets;
create policy "Active staff can update outlets"
on public.outlets
for update
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.staff
    where public.staff.auth_user_id = auth.uid()
      and public.staff.is_active = true
  )
)
with check (true);
