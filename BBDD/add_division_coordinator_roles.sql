-- =========================================================================
-- Migration: Add Division Coordinator Roles to app_role enum & Clean Divisions
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

-- =========================================================================
-- Limpieza de 'Detective Bureau' en divisiones de agentes específicos de división
-- Garantiza que usuarios de DOJ, IA, SEB y ASD solo tengan su división asignada
-- =========================================================================

-- Limpieza DOJ (la gente de DOJ y Coordinador DOJ solo deben tener 'DOJ')
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol = 'Coordinador DOJ'
    OR rango = 'Department of Justice Agent'
    OR (divisions @> ARRAY['DOJ']::text[] AND rol NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);

-- Limpieza IA (Coordinador IA y agentes de Asuntos Internos)
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol = 'Coordinador IA'
    OR rango = 'Internal Affairs Agent'
    OR (divisions @> ARRAY['Internal Affairs']::text[] AND rol NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);

-- Limpieza SEB (Coordinador SWAT/SEB y agentes SEB)
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol IN ('Coordinador SWAT/SEB', 'Coordinador SEB')
    OR rango = 'SEB Agent'
    OR (divisions @> ARRAY['SEB']::text[] AND rol NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);

-- Limpieza ASD (Coordinador ASD y agentes ASD)
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol = 'Coordinador ASD'
    OR rango = 'ASD Agent'
    OR (divisions @> ARRAY['ASD']::text[] AND rol NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);
