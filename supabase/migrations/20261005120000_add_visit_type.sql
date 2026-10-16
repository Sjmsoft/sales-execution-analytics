-- Distinguish daily attendance (shift) check-ins from outlet visit check-ins.
-- Both live in public.visits so the one-active-check-in-per-staff rule
-- (visits_one_active_visit_per_staff_idx) continues to apply across both types.
alter table public.visits
  add column if not exists visit_type text not null default 'outlet'
  check (visit_type in ('attendance', 'outlet'));

create index if not exists visits_visit_type_idx on public.visits(visit_type);
