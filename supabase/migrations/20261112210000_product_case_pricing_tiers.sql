-- ============================================================================
-- Migration: Product Pricing (Cases) - Tiered Case Pricing (Distributor, Wholesale, Retail)
-- Date: 2026-11-12
-- Description:
-- 1. Adds distributor_price, wholesale_price, retail_price, updated_at, and updated_by
--    columns to public.drink_types for case sales tiered pricing.
-- 2. Ensures public.price_categories contains Distributor, Wholesale, and Retail tiers.
-- 3. Configures RLS policies on public.drink_types, public.price_categories, and
--    public.pricing_history so Admin updates persist to Supabase and log history.
-- ============================================================================

-- 1. Add tiered case price columns to public.drink_types
ALTER TABLE public.drink_types
  ADD COLUMN IF NOT EXISTS distributor_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 2. Seed initial tiered prices for existing Fercullen products if not yet configured
UPDATE public.drink_types
SET
  distributor_price = 1710000,
  wholesale_price = 171,
  retail_price = 80000,
  price_per_case = CASE WHEN COALESCE(price_per_case, 0) = 0 THEN 1710000 ELSE price_per_case END
WHERE (name ILIKE '%21 Years%' OR name = '21 Years')
  AND COALESCE(distributor_price, 0) = 0
  AND COALESCE(wholesale_price, 0) = 0
  AND COALESCE(retail_price, 0) = 0;

UPDATE public.drink_types
SET
  distributor_price = 150000,
  wholesale_price = 5839,
  retail_price = 879223,
  price_per_case = CASE WHEN COALESCE(price_per_case, 0) = 0 THEN 150000 ELSE price_per_case END
WHERE name ILIKE '%Fercullen Falls%'
  AND COALESCE(distributor_price, 0) = 0
  AND COALESCE(wholesale_price, 0) = 0
  AND COALESCE(retail_price, 0) = 0;

UPDATE public.drink_types
SET
  distributor_price = 68000,
  wholesale_price = 508888,
  retail_price = 786222,
  price_per_case = CASE WHEN COALESCE(price_per_case, 0) = 0 THEN 68000 ELSE price_per_case END
WHERE (name ILIKE '%15 Years%' OR name = '15')
  AND COALESCE(distributor_price, 0) = 0
  AND COALESCE(wholesale_price, 0) = 0
  AND COALESCE(retail_price, 0) = 0;

UPDATE public.drink_types
SET
  distributor_price = 180000,
  wholesale_price = 89000,
  retail_price = 17559,
  price_per_case = CASE WHEN COALESCE(price_per_case, 0) = 0 THEN 180000 ELSE price_per_case END
WHERE name ILIKE '%Single Malt%'
  AND COALESCE(distributor_price, 0) = 0
  AND COALESCE(wholesale_price, 0) = 0
  AND COALESCE(retail_price, 0) = 0;

-- For any other existing drink_types rows without tiered prices, initialize from price_per_case
UPDATE public.drink_types
SET
  distributor_price = COALESCE(price_per_case, 0),
  wholesale_price = COALESCE(price_per_case, 0),
  retail_price = COALESCE(price_per_case, 0)
WHERE COALESCE(distributor_price, 0) = 0
  AND COALESCE(wholesale_price, 0) = 0
  AND COALESCE(retail_price, 0) = 0
  AND COALESCE(price_per_case, 0) > 0;

-- 3. Ensure public.price_categories has Distributor, Wholesale, and Retail
INSERT INTO public.price_categories (id, key, name, sort_order, is_active, color, created_at)
SELECT gen_random_uuid(), 'distributor', 'Distributor', 0, true, 'default', now()
WHERE NOT EXISTS (SELECT 1 FROM public.price_categories WHERE key = 'distributor');

INSERT INTO public.price_categories (id, key, name, sort_order, is_active, color, created_at)
SELECT gen_random_uuid(), 'wholesale', 'Wholesale', 1, true, 'default', now()
WHERE NOT EXISTS (SELECT 1 FROM public.price_categories WHERE key = 'wholesale');

INSERT INTO public.price_categories (id, key, name, sort_order, is_active, color, created_at)
SELECT gen_random_uuid(), 'retail', 'Retail', 2, true, 'default', now()
WHERE NOT EXISTS (SELECT 1 FROM public.price_categories WHERE key = 'retail');

-- 4. Enable RLS and policies on drink_types, price_categories, and pricing_history
ALTER TABLE public.drink_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow select for all on drink_types" ON public.drink_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow insert for all on drink_types" ON public.drink_types FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow update for all on drink_types" ON public.drink_types FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete for all on drink_types" ON public.drink_types;
CREATE POLICY "Allow delete for all on drink_types" ON public.drink_types FOR DELETE USING (true);

ALTER TABLE public.price_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all on price_categories" ON public.price_categories;
CREATE POLICY "Allow select for all on price_categories" ON public.price_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write for all on price_categories" ON public.price_categories;
CREATE POLICY "Allow write for all on price_categories" ON public.price_categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all on pricing_history" ON public.pricing_history;
CREATE POLICY "Allow select for all on pricing_history" ON public.pricing_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert for all on pricing_history" ON public.pricing_history;
CREATE POLICY "Allow insert for all on pricing_history" ON public.pricing_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update for all on pricing_history" ON public.pricing_history;
CREATE POLICY "Allow update for all on pricing_history" ON public.pricing_history FOR UPDATE USING (true) WITH CHECK (true);
