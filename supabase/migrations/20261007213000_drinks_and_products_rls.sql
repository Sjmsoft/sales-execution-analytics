-- Migration to ensure drink_types table exists with proper RLS policies and seed data
CREATE TABLE IF NOT EXISTS public.drink_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    bottles_per_case INTEGER DEFAULT 12,
    price_per_bottle NUMERIC DEFAULT 0,
    price_per_case NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT
);

-- Ensure created_at and created_by columns exist on existing drink_types table
ALTER TABLE public.drink_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.drink_types ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Enable RLS
ALTER TABLE public.drink_types ENABLE ROW LEVEL SECURITY;

-- Allow select for everyone (authenticated & anon)
DROP POLICY IF EXISTS "Allow select for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow select for all on drink_types"
    ON public.drink_types FOR SELECT
    USING (true);

-- Allow insert for authenticated and anon
DROP POLICY IF EXISTS "Allow insert for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow insert for all on drink_types"
    ON public.drink_types FOR INSERT
    WITH CHECK (true);

-- Allow update for authenticated and anon
DROP POLICY IF EXISTS "Allow update for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow update for all on drink_types"
    ON public.drink_types FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow delete for authenticated and anon
DROP POLICY IF EXISTS "Allow delete for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow delete for all on drink_types"
    ON public.drink_types FOR DELETE
    USING (true);

-- Seed initial drink_types if empty
INSERT INTO public.drink_types (name, category, price_per_bottle, price_per_case, bottles_per_case, created_by)
SELECT 'Fercullen 21 Years', 'Spirits', 0, 1710000, 1, 'System Admin'
WHERE NOT EXISTS (SELECT 1 FROM public.drink_types WHERE name = 'Fercullen 21 Years');

INSERT INTO public.drink_types (name, category, price_per_bottle, price_per_case, bottles_per_case, created_by)
SELECT 'Fercullen 15 Years', 'Spirits', 0, 420000, 1, 'System Admin'
WHERE NOT EXISTS (SELECT 1 FROM public.drink_types WHERE name = 'Fercullen 15 Years');

INSERT INTO public.drink_types (name, category, price_per_bottle, price_per_case, bottles_per_case, created_by)
SELECT 'Fercullen Falls', 'Spirits', 0, 212500, 1, 'System Admin'
WHERE NOT EXISTS (SELECT 1 FROM public.drink_types WHERE name = 'Fercullen Falls');

INSERT INTO public.drink_types (name, category, price_per_bottle, price_per_case, bottles_per_case, created_by)
SELECT 'Fercullen Single Malt', 'Spirits', 0, 305000, 1, 'System Admin'
WHERE NOT EXISTS (SELECT 1 FROM public.drink_types WHERE name = 'Fercullen Single Malt');
