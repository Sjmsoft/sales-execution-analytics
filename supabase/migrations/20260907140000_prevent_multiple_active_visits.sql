-- Enforce the one-active-visit rule even when requests are made outside the UI.
-- Preserve the newest active visit for each staff member and close historical duplicates.
with duplicate_active_visits as (
  select
    id,
    row_number() over (partition by staff_id order by check_in_at desc, id desc) as active_visit_rank
  from public.visits
  where check_out_at is null
)
update public.visits
set
  check_out_at = check_in_at,
  status = 'Completed'
where id in (
  select id
  from duplicate_active_visits
  where active_visit_rank > 1
);

create unique index if not exists visits_one_active_visit_per_staff_idx
  on public.visits (staff_id)
  where check_out_at is null;
