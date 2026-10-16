-- ============================================================================
-- Migration: Remove Unused Supabase Tables
-- Date: 2026-10-15
-- Description:
-- Drops unused legacy tables identified during app cleanup:
-- 1. public.attendance - Daily attendance tracking was consolidated into
--    public.visits (using visit_type = 'attendance') to enforce the
--    single-active-session constraint.
-- 2. public.inventory - Not used by any feature or workflow in the application.
-- 3. public.notifications - Notifications are delivered in real time and cached
--    locally via the messaging & push event system.
-- ============================================================================

-- Safely drop unreferenced tables if they exist
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
