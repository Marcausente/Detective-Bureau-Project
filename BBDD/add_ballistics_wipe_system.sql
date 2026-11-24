-- ==============================================================================
-- MIGRATION: Ballistics (Balística) Wipe Folders System
-- Permite almacenar y organizar casquillos y armas incautadas en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a ballistics_bullets si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ballistics_bullets' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.ballistics_bullets ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Añadir columna wipe_folder a ballistics_weapons si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ballistics_weapons' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.ballistics_weapons ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 3. Asegurar que los registros existentes tengan 'Actual' como carpeta por defecto
UPDATE public.ballistics_bullets 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

UPDATE public.ballistics_weapons 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 4. Crear índices para optimizar filtrados por carpeta de wipe
CREATE INDEX IF NOT EXISTS idx_ballistics_bullets_wipe_folder ON public.ballistics_bullets (wipe_folder);
CREATE INDEX IF NOT EXISTS idx_ballistics_weapons_wipe_folder ON public.ballistics_weapons (wipe_folder);

-- 5. Asegurar que app_settings cuenta con los registros iniciales para Wipes de Balística
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('ballistics_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('ballistics_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 6. Actualizar get_ballistics_bullets() para devolver wipe_folder
DROP FUNCTION IF EXISTS public.get_ballistics_bullets();
CREATE OR REPLACE FUNCTION public.get_ballistics_bullets()
RETURNS TABLE (
    id UUID,
    incidente_relacionado TEXT,
    calibre TEXT,
    numero_serie TEXT,
    modelo_arma TEXT,
    descripcion_incidente TEXT,
    case_id UUID,
    case_title TEXT,
    case_number INT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
    can_delete BOOLEAN,
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
        b.id,
        b.incidente_relacionado,
        b.calibre,
        b.numero_serie,
        COALESCE(b.modelo_arma, 'N/A') AS modelo_arma,
        b.descripcion_incidente,
        b.case_id,
        c.title AS case_title,
        c.case_number,
        b.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR b.author_id = v_uid) AS can_delete,
        COALESCE(NULLIF(TRIM(b.wipe_folder), ''), 'Actual') AS wipe_folder
    FROM public.ballistics_bullets b
    LEFT JOIN public.cases c ON b.case_id = c.id
    LEFT JOIN public.users u ON b.author_id = u.id
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_ballistics_bullets() TO authenticated;

-- 7. Actualizar get_ballistics_weapons() para devolver wipe_folder
DROP FUNCTION IF EXISTS public.get_ballistics_weapons();
CREATE OR REPLACE FUNCTION public.get_ballistics_weapons()
RETURNS TABLE (
    id UUID,
    propietario TEXT,
    incidente_relacionado TEXT,
    modelo TEXT,
    numero_serie TEXT,
    case_id UUID,
    case_title TEXT,
    case_number INT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
    can_delete BOOLEAN,
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
        w.id,
        w.propietario,
        w.incidente_relacionado,
        w.modelo,
        w.numero_serie,
        w.case_id,
        c.title AS case_title,
        c.case_number,
        w.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR w.author_id = v_uid) AS can_delete,
        COALESCE(NULLIF(TRIM(w.wipe_folder), ''), 'Actual') AS wipe_folder
    FROM public.ballistics_weapons w
    LEFT JOIN public.cases c ON w.case_id = c.id
    LEFT JOIN public.users u ON w.author_id = u.id
    ORDER BY w.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_ballistics_weapons() TO authenticated;
