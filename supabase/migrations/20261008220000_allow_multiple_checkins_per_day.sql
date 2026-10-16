-- Allow multiple check-ins to outlets per day by dropping the single active visit unique index.
-- This enables field representatives to visit multiple outlets throughout the day and
-- maintain both attendance shifts and outlet visits concurrently.

drop index if exists public.visits_one_active_visit_per_staff_idx;

-- Add a non-unique composite index to optimize active visit lookups by staff member
create index if not exists visits_staff_active_idx on public.visits (staff_id, check_out_at);
