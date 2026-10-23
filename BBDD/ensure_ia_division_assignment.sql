-- =========================================================================
-- Script: Asegurar la división 'Internal Affairs' a agentes y coordinadores IA / IAB
-- =========================================================================
-- Asigna la división 'Internal Affairs' a cualquier usuario que posea el rango
-- 'Internal Affairs Agent' (o rango relacionado con IAB / Asuntos Internos) o rol 'Coordinador IA'.
-- Esto garantiza que en la base de datos sus divisiones incluyan 'Internal Affairs'.
-- =========================================================================

UPDATE public.users
SET divisions = array_append(COALESCE(divisions, ARRAY[]::text[]), 'Internal Affairs')
WHERE (
    rol::text = 'Coordinador IA'
    OR COALESCE(rango::text, '') = 'Internal Affairs Agent'
    OR COALESCE(rango::text, '') ILIKE '%Internal Affairs%'
    OR COALESCE(rango::text, '') ILIKE '%IAB%'
)
AND NOT ('Internal Affairs' = ANY(COALESCE(divisions, ARRAY[]::text[])));

-- Asegurar también que no tengan 'Detective Bureau' si son agentes exclusivos de IA
UPDATE public.users
SET divisions = array_remove(divisions, 'Detective Bureau')
WHERE (
    rol::text = 'Coordinador IA'
    OR COALESCE(rango::text, '') = 'Internal Affairs Agent'
    OR COALESCE(rango::text, '') ILIKE '%Internal Affairs%'
    OR COALESCE(rango::text, '') ILIKE '%IAB%'
)
AND rol::text NOT IN ('Administrador', 'Comisionado', 'Coordinador')
AND 'Detective Bureau' = ANY(COALESCE(divisions, ARRAY[]::text[]));
