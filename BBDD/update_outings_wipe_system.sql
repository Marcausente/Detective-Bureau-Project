-- ==============================================================================
-- MIGRATION: Outings Wipe Folders System
-- Asegura que la tabla outings tenga la columna wipe_folder y actualiza get_outings()
-- para devolver wipe_folder TEXT y soportar filtrado por carpeta de wipe.
-- ==============================================================================

-- 1. Añadir columna wipe_folder a outings si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'outings' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.outings ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que las salidas existentes tengan 'Actual' como carpeta por defecto
UPDATE public.outings 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar consultas por wipe_folder en outings
CREATE INDEX IF NOT EXISTS idx_outings_wipe_folder ON public.outings (wipe_folder);

-- 4. Actualizar get_outings para devolver wipe_folder y soportar parámetro opcional p_wipe_folder
DROP FUNCTION IF EXISTS public.get_outings();
DROP FUNCTION IF EXISTS public.get_outings(TEXT);

CREATE OR REPLACE FUNCTION public.get_outings(p_wipe_folder TEXT DEFAULT NULL)
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    detectives JSONB,
    gang_id UUID,
    gang_names TEXT[],
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    can_delete BOOLEAN,
    tag TEXT,
    interrogations JSONB,
    documents JSONB,
    wipe_folder TEXT
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(u_auth.rol::text) INTO v_user_role FROM public.users u_auth WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        o.id,
        o.title,
        o.occurred_at,
        o.reason,
        o.info_obtained,
        COALESCE(o.images, '[]'::jsonb),
        o.created_at,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', u.id, 
                'name', u.nombre || ' ' || u.apellido, 
                'rank', u.rango,
                'avatar', u.profile_image
            ))
             FROM public.outing_detectives od
             JOIN public.users u ON od.user_id = u.id 
             WHERE od.outing_id = o.id),
            '[]'::jsonb
        ),
        (SELECT og.gang_id FROM public.outing_gangs og WHERE og.outing_id = o.id LIMIT 1),
        ARRAY(
            SELECT g.name 
            FROM public.outing_gangs og 
            JOIN public.gangs g ON og.gang_id = g.id 
            WHERE og.outing_id = o.id
            ORDER BY g.name
        )::TEXT[],
        COALESCE(u.nombre || ' ' || u.apellido, 'Unknown'),
        COALESCE(u.rango::text, 'N/A'),
        u.profile_image,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective') OR o.created_by = v_uid) as can_delete,
        o.tag,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', inter.id,
                'title', inter.title
            ))
            FROM public.outing_interrogations oi
            JOIN public.interrogations inter ON oi.interrogation_id = inter.id
            WHERE oi.outing_id = o.id),
            '[]'::jsonb
        ) as interrogations,
        COALESCE(o.documents, '[]'::jsonb) as documents,
        COALESCE(NULLIF(TRIM(o.wipe_folder), ''), 'Actual') as wipe_folder
    FROM public.outings o
    LEFT JOIN public.users u ON o.created_by = u.id
    WHERE (
        p_wipe_folder IS NULL 
        OR o.wipe_folder = p_wipe_folder 
        OR (p_wipe_folder = 'Actual' AND (o.wipe_folder IS NULL OR o.wipe_folder = ''))
    )
    ORDER BY o.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_outings(TEXT) TO authenticated, anon;
