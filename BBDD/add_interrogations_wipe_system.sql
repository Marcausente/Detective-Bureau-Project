-- ==============================================================================
-- MIGRATION: Interrogations (Interrogatorios) Wipe Folders System
-- Permite almacenar y organizar interrogatorios en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla interrogations si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'interrogations' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.interrogations ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que los interrogatorios existentes tengan 'Actual' como carpeta por defecto
UPDATE public.interrogations 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar filtrados por carpeta de wipe en interrogatorios
CREATE INDEX IF NOT EXISTS idx_interrogations_wipe_folder ON public.interrogations (wipe_folder);

-- 4. Asegurar que app_settings cuenta con los registros iniciales para Wipes de Interrogatorios
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('interrogations_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('interrogations_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Actualizar función RPC get_interrogations() para devolver wipe_folder
DROP FUNCTION IF EXISTS public.get_interrogations();
CREATE OR REPLACE FUNCTION get_interrogations()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  author_id UUID,
  author_name TEXT,
  title TEXT,
  interrogation_date DATE,
  agents_present TEXT,
  subjects TEXT,
  transcription TEXT,
  media_url TEXT,
  can_edit BOOLEAN,
  wipe_folder TEXT
) AS $$
DECLARE
  v_user_role TEXT;
  v_user_id UUID;
  v_user_full_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT u.rol::text, (u.nombre || ' ' || u.apellido) INTO v_user_role, v_user_full_name
  FROM public.users u WHERE u.id = v_user_id;

  RETURN QUERY
  SELECT 
    i.id,
    i.created_at,
    i.author_id,
    (u.nombre || ' ' || u.apellido) as author_name,
    i.title,
    i.interrogation_date,
    i.agents_present,
    i.subjects,
    i.transcription,
    i.media_url,
    (v_user_role IN ('Coordinador', 'Comisionado', 'Administrador') OR i.author_id = v_user_id) as can_edit,
    COALESCE(NULLIF(TRIM(i.wipe_folder), ''), 'Actual') as wipe_folder
  FROM public.interrogations i
  LEFT JOIN public.users u ON i.author_id = u.id
  WHERE 
    CASE 
      WHEN v_user_role IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN TRUE
      ELSE (
        i.author_id = v_user_id 
        OR (v_user_full_name IS NOT NULL AND i.agents_present ILIKE '%' || v_user_full_name || '%')
      )
    END
  ORDER BY i.interrogation_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_interrogations() TO authenticated;
