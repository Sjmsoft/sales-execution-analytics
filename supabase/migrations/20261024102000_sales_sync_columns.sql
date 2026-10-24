-- Migration: Add compatible columns and sync trigger for public.sales
-- Allows both Title Case ("Total Amount", "Outlet", etc.) and snake_case (total_amount, outlet, etc.)
-- to work interchangeably in Supabase and the application.

do $$
begin
  alter table public.sales add column if not exists id uuid default gen_random_uuid();
  alter table public.sales add column if not exists sale_date text;
  alter table public.sales add column if not exists total_amount numeric;
  alter table public.sales add column if not exists amount_paid numeric;
  alter table public.sales add column if not exists balance numeric;
  alter table public.sales add column if not exists quantity bigint;
  alter table public.sales add column if not exists outlet text;
  alter table public.sales add column if not exists staff text;
  alter table public.sales add column if not exists drink_type text;
  alter table public.sales add column if not exists payment_status text;
  alter table public.sales add column if not exists unit_type text;
  alter table public.sales add column if not exists reference text;
  alter table public.sales add column if not exists transaction_id text;
  alter table public.sales add column if not exists created_at timestamptz default now();
end $$;

-- Populate snake_case columns from Title Case columns
update public.sales set
  sale_date = coalesce(sale_date, "Sale Date"),
  total_amount = coalesce(total_amount, nullif(regexp_replace(coalesce("Total Amount", '0'), '[^0-9.-]', '', 'g'), '')::numeric),
  amount_paid = coalesce(amount_paid, nullif(regexp_replace(coalesce("Amount Paid", '0'), '[^0-9.-]', '', 'g'), '')::numeric),
  balance = coalesce(balance, nullif(regexp_replace(coalesce("Balance", '0'), '[^0-9.-]', '', 'g'), '')::numeric),
  quantity = coalesce(quantity, "Quantity"),
  outlet = coalesce(outlet, "Outlet"),
  staff = coalesce(staff, "Staff Name"),
  drink_type = coalesce(drink_type, "Drink Type"),
  payment_status = coalesce(payment_status, "Payment Status"),
  unit_type = coalesce(unit_type, "Unit Type"),
  reference = coalesce(reference, "Reference"),
  transaction_id = coalesce(transaction_id, "Transaction ID")
where "Transaction ID" is not null;

-- Bi-directional sync trigger function
create or replace function public.sync_sales_columns()
returns trigger
language plpgsql
as $$
begin
  -- If Title Case columns are provided, sync to snake_case
  if new."Outlet" is not null and new.outlet is null then
    new.outlet := new."Outlet";
  end if;
  if new."Staff Name" is not null and new.staff is null then
    new.staff := new."Staff Name";
  end if;
  if new."Drink Type" is not null and new.drink_type is null then
    new.drink_type := new."Drink Type";
  end if;
  if new."Sale Date" is not null and new.sale_date is null then
    new.sale_date := new."Sale Date";
  end if;
  if new."Reference" is not null and new.reference is null then
    new.reference := new."Reference";
  end if;
  if new."Transaction ID" is not null and new.transaction_id is null then
    new.transaction_id := new."Transaction ID";
  end if;
  if new."Quantity" is not null and new.quantity is null then
    new.quantity := new."Quantity";
  end if;
  if new."Unit Type" is not null and new.unit_type is null then
    new.unit_type := new."Unit Type";
  end if;
  if new."Payment Status" is not null and new.payment_status is null then
    new.payment_status := new."Payment Status";
  end if;
  if new."Total Amount" is not null and new.total_amount is null then
    new.total_amount := nullif(regexp_replace(new."Total Amount", '[^0-9.-]', '', 'g'), '')::numeric;
  end if;
  if new."Amount Paid" is not null and new.amount_paid is null then
    new.amount_paid := nullif(regexp_replace(new."Amount Paid", '[^0-9.-]', '', 'g'), '')::numeric;
  end if;
  if new."Balance" is not null and new.balance is null then
    new.balance := nullif(regexp_replace(new."Balance", '[^0-9.-]', '', 'g'), '')::numeric;
  end if;

  -- If snake_case columns are provided, sync to Title Case
  if new.outlet is not null and new."Outlet" is null then
    new."Outlet" := new.outlet;
  end if;
  if new.staff is not null and new."Staff Name" is null then
    new."Staff Name" := new.staff;
  end if;
  if new.drink_type is not null and new."Drink Type" is null then
    new."Drink Type" := new.drink_type;
  end if;
  if new.sale_date is not null and new."Sale Date" is null then
    new."Sale Date" := new.sale_date;
  end if;
  if new.reference is not null and new."Reference" is null then
    new."Reference" := new.reference;
  end if;
  if new.transaction_id is not null and new."Transaction ID" is null then
    new."Transaction ID" := new.transaction_id;
  end if;
  if new.quantity is not null and new."Quantity" is null then
    new."Quantity" := new.quantity;
  end if;
  if new.unit_type is not null and new."Unit Type" is null then
    new."Unit Type" := new.unit_type;
  end if;
  if new.payment_status is not null and new."Payment Status" is null then
    new."Payment Status" := new.payment_status;
  end if;
  if new.total_amount is not null and new."Total Amount" is null then
    new."Total Amount" := to_char(new.total_amount, 'FM999,999,999.00');
  end if;
  if new.amount_paid is not null and new."Amount Paid" is null then
    new."Amount Paid" := to_char(new.amount_paid, 'FM999,999,999.00');
  end if;
  if new.balance is not null and new."Balance" is null then
    new."Balance" := to_char(new.balance, 'FM999,999,999.00');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_sales_columns on public.sales;
create trigger trg_sync_sales_columns
before insert or update on public.sales
for each row
execute function public.sync_sales_columns();
