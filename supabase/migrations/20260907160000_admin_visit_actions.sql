drop policy if exists "Staff can update own visits" on public.visits;
create policy "Staff and administrators can update visits"
on public.visits for update to authenticated
using (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
  or exists (select 1 from public.staff join public.user_roles on public.user_roles.id = public.staff.assigned_role where public.staff.auth_user_id = auth.uid() and public.staff.is_active = true and public.user_roles.key = 'administrator')
)
with check (true);

drop policy if exists "Administrators can delete visits" on public.visits;
create policy "Administrators can delete visits"
on public.visits for delete to authenticated
using (exists (select 1 from public.staff join public.user_roles on public.user_roles.id = public.staff.assigned_role where public.staff.auth_user_id = auth.uid() and public.staff.is_active = true and public.user_roles.key = 'administrator'));
