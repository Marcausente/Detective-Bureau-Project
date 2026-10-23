-- =========================================================================
-- Script de Restauración: Asegurar 'Detective Bureau' en usuarios DB
-- =========================================================================
-- Restaura la división 'Detective Bureau' a cualquier agente con rol 'Detective',
-- 'Ayudante' (de DB) o mandos, asegurando que ninguno pierda el acceso a sus canales.
-- No afecta a los agentes exclusivos de DOJ, IA, SEB o ASD.
-- =========================================================================

UPDATE public.users
SET divisions = array_append(COALESCE(divisions, ARRAY[]::text[]), 'Detective Bureau')
WHERE (
    rol::text = 'Detective'
    OR rol::text = 'Coordinador'
    OR rol::text = 'Comisionado'
    OR rol::text = 'Administrador'
    OR (
        rol::text = 'Ayudante'
        AND rol::text NOT IN ('Coordinador IA', 'Coordinador ASD', 'Coordinador SWAT/SEB', 'Coordinador DOJ')
        AND COALESCE(rango, '') NOT IN ('Department of Justice Agent', 'Internal Affairs Agent', 'SEB Agent', 'ASD Agent')
    )
)
AND NOT ('Detective Bureau' = ANY(COALESCE(divisions, ARRAY[]::text[])));
