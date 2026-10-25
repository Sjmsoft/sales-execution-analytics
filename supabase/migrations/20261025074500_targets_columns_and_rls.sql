-- Migration: Add missing columns, set defaults, and configure RLS policies for public.targets

-- 1. Ensure sensible column defaults
ALTER TABLE public.targets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.targets ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE public.targets ALTER COLUMN target_type SET DEFAULT 1;

-- 2. Add missing metadata columns to public.targets
ALTER TABLE public.targets ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Cases';
ALTER TABLE public.targets ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.targets ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT false;
ALTER TABLE public.targets ADD COLUMN IF NOT EXISTS bundle_count INTEGER DEFAULT 1;
ALTER TABLE public.targets ADD COLUMN IF NOT EXISTS bundled_drinks JSONB DEFAULT '[]'::jsonb;

-- 3. Configure RLS
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

-- Drop legacy restrictive policies
DROP POLICY IF EXISTS "Allow select for all" ON public.targets;
DROP POLICY IF EXISTS "targets_select" ON public.targets;
CREATE POLICY "Allow select for all"
ON public.targets FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Allow insert for all" ON public.targets;
DROP POLICY IF EXISTS "targets_insert" ON public.targets;
CREATE POLICY "Allow insert for all"
ON public.targets FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for all" ON public.targets;
DROP POLICY IF EXISTS "targets_update" ON public.targets;
CREATE POLICY "Allow update for all"
ON public.targets FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete for all" ON public.targets;
DROP POLICY IF EXISTS "targets_delete" ON public.targets;
CREATE POLICY "Allow delete for all"
ON public.targets FOR DELETE
TO authenticated, anon
USING (true);

-- 4. Grant access
GRANT ALL ON public.targets TO authenticated, anon;
