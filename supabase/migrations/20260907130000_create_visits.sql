create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  status text not null default 'Completed' check (status in ('Completed', 'Active', 'Pending')),
  outcome text not null default 'Successful' check (outcome in ('Successful', 'Partial', 'Pending')),
  gps_latitude double precision not null,
  gps_longitude double precision not null,
  gps_accuracy_meters double precision,
  gps_distance_meters double precision,
  photo_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists visits_outlet_id_idx on public.visits(outlet_id);
create index if not exists visits_staff_id_idx on public.visits(staff_id);
create index if not exists visits_check_in_at_idx on public.visits(check_in_at desc);

alter table public.visits enable row level security;

drop policy if exists "Staff can view own visits" on public.visits;
create policy "Staff can view own visits"
on public.visits
for select
to authenticated
using (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
  or exists (
    select 1
    from public.staff
    join public.user_roles on public.user_roles.id = public.staff.assigned_role
    where public.staff.auth_user_id = auth.uid()
      and public.staff.is_active = true
      and public.user_roles.key = 'administrator'
  )
);

drop policy if exists "Staff can create own visits" on public.visits;
create policy "Staff can create own visits"
on public.visits
for insert
to authenticated
with check (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
);

drop policy if exists "Staff can update own visits" on public.visits;
create policy "Staff can update own visits"
on public.visits
for update
to authenticated
using (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
)
with check (
  staff_id = (select id from public.staff where auth_user_id = auth.uid() and is_active = true)
);
