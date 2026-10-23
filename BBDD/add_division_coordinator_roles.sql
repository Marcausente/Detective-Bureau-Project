-- =========================================================================
-- Migration: Add Division Coordinator Roles to app_role enum & Clean Divisions
-- =========================================================================
-- New Roles:
-- 1. 'Coordinador IA'
-- 2. 'Coordinador ASD'
-- 3. 'Coordinador SWAT/SEB'
-- 4. 'Coordinador DOJ'
-- =========================================================================

-- 1. Añadir los nuevos valores al enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador IA';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador ASD';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador SWAT/SEB';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinador DOJ';

-- =========================================================================
-- 2. Limpieza de 'Detective Bureau' en divisiones de agentes de división
-- Usamos rol::text para evitar cualquier error de casting de tipo enum
-- =========================================================================

-- Limpieza DOJ (la gente de DOJ y Coordinador DOJ solo deben tener 'DOJ')
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol::text = 'Coordinador DOJ'
    OR rango = 'Department of Justice Agent'
    OR (divisions @> ARRAY['DOJ']::text[] AND rol::text NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);

-- Limpieza IA (Coordinador IA y agentes de Asuntos Internos)
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol::text = 'Coordinador IA'
    OR rango = 'Internal Affairs Agent'
    OR (divisions @> ARRAY['Internal Affairs']::text[] AND rol::text NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);

-- Limpieza SEB (Coordinador SWAT/SEB y agentes SEB)
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol::text IN ('Coordinador SWAT/SEB', 'Coordinador SEB')
    OR rango = 'SEB Agent'
    OR (divisions @> ARRAY['SEB']::text[] AND rol::text NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);

-- Limpieza ASD (Coordinador ASD y agentes ASD)
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol::text = 'Coordinador ASD'
    OR rango = 'ASD Agent'
    OR (divisions @> ARRAY['ASD']::text[] AND rol::text NOT IN ('Administrador', 'Comisionado', 'Coordinador'))
)
AND 'Detective Bureau' = ANY(divisions);
