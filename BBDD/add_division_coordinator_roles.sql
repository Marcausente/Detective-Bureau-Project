-- =========================================================================
-- Migration: Add Division Coordinator Roles to app_role enum
-- =========================================================================
-- New Roles:
-- 1. 'Coordinador IA'
-- 2. 'Coordinador ASD'
-- 3. 'Coordinador SWAT/SEB'
-- 4. 'Coordinador DOJ'
--
-- These roles have the same system-wide base permissions as 'Ayudante',
-- but they have permission to add new members to Personnel restricted to
-- their specific division and with the system role locked to 'Ayudante'.
-- =========================================================================

DO $$
BEGIN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador IA';
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador ASD';
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador SWAT/SEB';
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador DOJ';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
