-- ============================================================================
-- Migration: Pricing History Delete RLS & Default ID
-- Date: 2026-11-12
-- ============================================================================

ALTER TABLE public.pricing_history
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete for all on pricing_history" ON public.pricing_history;
CREATE POLICY "Allow delete for all on pricing_history"
  ON public.pricing_history FOR DELETE
  USING (true);

