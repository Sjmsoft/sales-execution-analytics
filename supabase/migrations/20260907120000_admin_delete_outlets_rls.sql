alter table public.outlets enable row level security;

drop policy if exists "Administrators can delete outlets" on public.outlets;
create policy "Administrators can delete outlets"
on public.outlets
for delete
to authenticated
using (
  exists (
    select 1
    from public.staff
    join public.user_roles
      on public.user_roles.id = public.staff.assigned_role
    where public.staff.auth_user_id = auth.uid()
      and public.staff.is_active = true
      and public.user_roles.key = 'administrator'
  )
);

drop policy if exists "Authenticated users can view outlets" on public.outlets;
create policy "Authenticated users can view outlets"
on public.outlets
for select
to authenticated
using (true);