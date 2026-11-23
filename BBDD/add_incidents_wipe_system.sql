-- ==============================================================================
-- MIGRATION: Incidents & Outings Wipe Folders System
-- Permite almacenar y organizar incidentes/informes y salidas en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla incidents si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'incidents' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.incidents ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que los incidentes existentes tengan 'Actual' como carpeta por defecto
UPDATE public.incidents 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar filtrados por carpeta de wipe en incidents
CREATE INDEX IF NOT EXISTS idx_incidents_wipe_folder ON public.incidents (wipe_folder);

-- 4. Añadir columna wipe_folder a la tabla outings (salidas) si no existe
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

-- 5. Asegurar que las salidas existentes tengan 'Actual' como carpeta por defecto
UPDATE public.outings 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 6. Crear índice en outings
CREATE INDEX IF NOT EXISTS idx_outings_wipe_folder ON public.outings (wipe_folder);

-- 7. Asegurar que app_settings cuenta con los registros iniciales para Wipes de Incidentes
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('incidents_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('incidents_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 8. Actualizar get_incidents_v2 para soportar filtrado por wipe_folder y devolver wipe_folder
DROP FUNCTION IF EXISTS get_incidents_v2();
DROP FUNCTION IF EXISTS get_incidents_v2(TEXT);

CREATE OR REPLACE FUNCTION get_incidents_v2(p_wipe_folder TEXT DEFAULT 'Actual')
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    location TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    tablet_number TEXT,
    description TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    gang_id UUID,
    gang_names TEXT[],
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    is_author BOOLEAN,
    can_delete BOOLEAN,
    interrogations JSONB,
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
        i.id,
        i.title,
        i.location,
        i.occurred_at,
        i.tablet_incident_number,
        i.description,
        i.images,
        i.created_at,
        (SELECT ig.gang_id FROM public.incident_gangs ig WHERE ig.incident_id = i.id LIMIT 1),
        ARRAY(
            SELECT g.name 
            FROM public.incident_gangs ig 
            JOIN public.gangs g ON ig.gang_id = g.id 
            WHERE ig.incident_id = i.id
            ORDER BY g.name
        )::TEXT[],
        COALESCE(u.nombre || ' ' || u.apellido, 'Unknown'),
        COALESCE(u.rango::text, 'N/A'),
        u.profile_image,
        (i.author_id = v_uid) as is_author,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) as can_delete,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', inter.id,
                'title', inter.title
            ))
            FROM public.incident_interrogations ii
            JOIN public.interrogations inter ON ii.interrogation_id = inter.id
            WHERE ii.incident_id = i.id),
            '[]'::jsonb
        ) as interrogations,
        COALESCE(i.wipe_folder, 'Actual') as wipe_folder
    FROM public.incidents i
    LEFT JOIN public.users u ON i.author_id = u.id
    WHERE (
        p_wipe_folder IS NULL 
        OR i.wipe_folder = p_wipe_folder 
        OR (p_wipe_folder = 'Actual' AND (i.wipe_folder IS NULL OR i.wipe_folder = ''))
    )
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_incidents_v2(TEXT) TO authenticated, anon;
