-- Migration: Make public."Outlets List" the source of truth for outlet data.
--
-- The app keeps reading/writing public.outlets (sales.outlet_id and
-- visits.outlet_id reference outlets.id, and "Outlets List" has no id column).
-- This migration:
--   1. Ensures outlets columns (region_id, assigned_manager, outlet_type) support text.
--   2. Adds helpers that map an "Outlets List" row onto the outlets schema.
--   3. Merges every "Outlets List" row into public.outlets, matched by outlet
--      name (case/whitespace-insensitive). Matches are updated, new names are
--      inserted. Existing outlets not present in the list are left untouched
--      so historical visits/sales stay intact.
--   4. Installs a trigger so future inserts/updates on "Outlets List" are
--      mirrored into public.outlets automatically.

-- ---------------------------------------------------------------------------
-- 0. Column type adjustments (drop FKs & dependent view temporarily)
-- ---------------------------------------------------------------------------

drop view if exists public.v_outlet_performance;

do $$
begin
  -- Drop foreign key constraints that prevent region_id and assigned_manager from storing text
  if exists (
    select 1 from pg_constraint where conname = 'fk_outlets_region_id' and conrelid = 'public.outlets'::regclass
  ) then
    alter table public.outlets drop constraint fk_outlets_region_id;
  end if;

  if exists (
    select 1 from pg_constraint where conname = 'fk_outlets_assigned_manager' and conrelid = 'public.outlets'::regclass
  ) then
    alter table public.outlets drop constraint fk_outlets_assigned_manager;
  end if;

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

-- Recreate view with updated column types
create or replace view public.v_outlet_performance as
 with sale_agg as (
   select s.outlet,
      count(*) as transaction_count,
      coalesce(sum(s.quantity), 0::bigint) as units_sold,
      coalesce(sum(s.total_amount), 0::numeric)::numeric(19,4) as gross_sales,
      max(s.sale_date) as last_sale_at
     from sales s
    group by s.outlet
  ), visit_agg as (
   select ov.outlet,
      count(*) as visit_count,
      max(ov.visit_date) as last_visit_at
     from outlet_visits ov
    group by ov.outlet
  )
 select o.id as outlet_id,
    o.name as outlet_name,
    o.address,
    o.state,
    o.lga,
    o.region_id,
    o.assigned_manager,
    o.listing_status,
    coalesce(sa.transaction_count, 0::bigint) as transaction_count,
    coalesce(sa.units_sold, 0::bigint) as units_sold,
    coalesce(sa.gross_sales, 0::numeric)::numeric(19,4) as gross_sales,
    coalesce(va.visit_count, 0::bigint) as visit_count,
    sa.last_sale_at,
    va.last_visit_at
   from outlets o
     left join sale_agg sa on sa.outlet = o.id
     left join visit_agg va on va.outlet = o.id;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.outlets_list_clean(val text)
returns text
language sql
immutable
as $$
  select nullif(btrim(val), '');
$$;

create or replace function public.outlets_list_num(val text)
returns double precision
language plpgsql
immutable
as $$
begin
  if public.outlets_list_clean(val) is null then
    return null;
  end if;
  return btrim(val)::double precision;
exception when others then
  return null;
end;
$$;

create or replace function public.outlets_list_ts(val text)
returns timestamptz
language plpgsql
stable
as $$
begin
  if public.outlets_list_clean(val) is null then
    return null;
  end if;
  return btrim(val)::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.outlets_list_outlet_type(val text)
returns text
language sql
immutable
as $$
  select case
    when public.outlets_list_clean(val) is null then null
    when regexp_replace(lower(val), '[^a-z]', '', 'g') in ('ontrade', '1') then 'on-trade'
    when regexp_replace(lower(val), '[^a-z]', '', 'g') in ('offtrade', '2') then 'off-trade'
    when regexp_replace(lower(val), '[^a-z]', '', 'g') in ('keyaccount', 'keyaccounts', 'ka') then 'key_account'
    when regexp_replace(lower(val), '[^a-z]', '', 'g') in ('moderntrade', 'mt') then 'mt'
    when btrim(val) = '1' then 'on-trade'
    when btrim(val) = '2' then 'off-trade'
    when btrim(val) = '3' then 'key_account'
    when btrim(val) = '4' then 'mt'
    when lower(btrim(val)) = 'unassigned' then 'on-trade'
    else btrim(val)
  end;
$$;

create or replace function public.outlets_list_listing_status(val text)
returns integer
language sql
immutable
as $$
  select case
    when regexp_replace(lower(coalesce(val, '')), '[^a-z]', '', 'g') in ('listed', 'yes', 'true', '1') then 1
    else 0
  end;
$$;

-- Resolves a staff reference (uuid, name or email) to staff.id; null if unknown.
create or replace function public.outlets_list_staff_id(val text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.staff s
  where public.outlets_list_clean(val) is not null
    and (
      s.id::text = btrim(val)
      or lower(btrim(s.name)) = lower(btrim(val))
      or lower(btrim(s.email)) = lower(btrim(val))
    )
  order by s.is_active desc
  limit 1;
$$;

-- Upserts a single "Outlets List" row into public.outlets, matched by name.
create or replace function public.upsert_outlet_from_list(r public."Outlets List")
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := public.outlets_list_clean(r."Outlet Name"::text);
  v_id uuid;
  v_manager text;
  v_raw_mgr text := public.outlets_list_clean(r."Assigned Manager"::text);
  v_accuracy numeric := public.outlets_list_num(r."Accuracy Threshold (m)"::text);
  v_geofence integer := public.outlets_list_num(r."Geofence Radius (m)"::text)::integer;
  v_created_ts timestamptz := public.outlets_list_ts(r."Created At"::text);
begin
  if v_name is null then
    return null;
  end if;

  -- Filter out placeholder "Assigned manager"
  if v_raw_mgr is not null and lower(v_raw_mgr) != 'assigned manager' then
    v_manager := coalesce(
      public.outlets_list_staff_id(v_raw_mgr)::text,
      v_raw_mgr
    );
  else
    v_manager := null;
  end if;

  select o.id into v_id
  from public.outlets o
  where lower(btrim(o.name)) = lower(v_name)
  order by o.created_at nulls last
  limit 1;

  if v_id is not null then
    update public.outlets o set
      name                               = v_name,
      outlet_type                        = coalesce(public.outlets_list_outlet_type(r."Outlet Type"::text), o.outlet_type),
      listing_status                     = public.outlets_list_listing_status(r."Listed Status"::text),
      region_id                          = coalesce(public.outlets_list_clean(r."Region"::text), o.region_id),
      address                            = coalesce(public.outlets_list_clean(r."Address"::text), o.address),
      state                              = coalesce(public.outlets_list_clean(r."State"::text), o.state),
      lga                                = coalesce(public.outlets_list_clean(r."LGA"::text), o.lga),
      gpslatitude                        = coalesce(public.outlets_list_num(r."GPS Latitude"::text), o.gpslatitude),
      gpslongitude                       = coalesce(public.outlets_list_num(r."GPS Longitude"::text), o.gpslongitude),
      registrationaccuracymeters         = coalesce(v_accuracy, o.registrationaccuracymeters),
      geofence_radius_meters             = coalesce(v_geofence, o.geofence_radius_meters),
      registration_location_captured_on  = coalesce(v_created_ts, o.registration_location_captured_on),
      contact_person_name                = coalesce(public.outlets_list_clean(r."Contact Name"::text), o.contact_person_name),
      contact_person_phone               = coalesce(public.outlets_list_clean(r."Contact Phone"::text), o.contact_person_phone),
      contact_person_email               = coalesce(public.outlets_list_clean(r."Contact Email"::text), o.contact_person_email),
      assigned_manager                   = coalesce(v_manager, o.assigned_manager),
      visit_remarks                      = coalesce(public.outlets_list_clean(r."Remarks"::text), o.visit_remarks),
      updated_at                         = now()
    where o.id = v_id;
  else
    insert into public.outlets (
      name, outlet_type, listing_status, region_id, address, state, lga,
      gpslatitude, gpslongitude, registrationaccuracymeters, geofence_radius_meters,
      registration_location_captured_on, contact_person_name, contact_person_phone,
      contact_person_email, assigned_manager, visit_remarks, created_by, created_at, updated_at
    ) values (
      v_name,
      coalesce(public.outlets_list_outlet_type(r."Outlet Type"::text), 'on-trade'),
      public.outlets_list_listing_status(r."Listed Status"::text),
      public.outlets_list_clean(r."Region"::text),
      coalesce(public.outlets_list_clean(r."Address"::text), 'Address not specified'),
      coalesce(public.outlets_list_clean(r."State"::text), 'Unassigned'),
      coalesce(public.outlets_list_clean(r."LGA"::text), 'Unassigned'),
      public.outlets_list_num(r."GPS Latitude"::text),
      public.outlets_list_num(r."GPS Longitude"::text),
      v_accuracy,
      v_geofence,
      coalesce(v_created_ts, now()),
      public.outlets_list_clean(r."Contact Name"::text),
      public.outlets_list_clean(r."Contact Phone"::text),
      public.outlets_list_clean(r."Contact Email"::text),
      v_manager,
      public.outlets_list_clean(r."Remarks"::text),
      public.outlets_list_staff_id(r."Created By"::text),
      coalesce(v_created_ts, now()),
      now()
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. One-off merge of the existing list (oldest first so the latest row for a
--    duplicated name wins).
-- ---------------------------------------------------------------------------

do $$
declare
  rec public."Outlets List";
  n_rows integer := 0;
begin
  for rec in
    select *
    from public."Outlets List"
    order by public.outlets_list_ts("Created At"::text) asc nulls first
  loop
    if public.upsert_outlet_from_list(rec) is not null then
      n_rows := n_rows + 1;
    end if;
  end loop;
  raise notice 'Merged % row(s) from "Outlets List" into public.outlets', n_rows;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Keep public.outlets in sync with future changes to "Outlets List".
-- ---------------------------------------------------------------------------

create or replace function public.sync_outlets_list_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_outlet_from_list(new);
  return new;
end;
$$;

drop trigger if exists trg_sync_outlets_list on public."Outlets List";
create trigger trg_sync_outlets_list
after insert or update on public."Outlets List"
for each row
execute function public.sync_outlets_list_row();
