-- Migration: Enable RLS and setup policies on public.sales
alter table public.sales enable row level security;

drop policy if exists "Allow select for all" on public.sales;
create policy "Allow select for all"
on public.sales for select
to authenticated, anon
using (true);

drop policy if exists "Allow insert for authenticated" on public.sales;
create policy "Allow insert for authenticated"
on public.sales for insert
to authenticated, anon
with check (true);

drop policy if exists "Allow update for authenticated" on public.sales;
create policy "Allow update for authenticated"
on public.sales for update
to authenticated, anon
using (true)
with check (true);

drop policy if exists "Allow delete for authenticated" on public.sales;
create policy "Allow delete for authenticated"
on public.sales for delete
to authenticated, anon
using (true);

grant all on public.sales to authenticated, anon;
