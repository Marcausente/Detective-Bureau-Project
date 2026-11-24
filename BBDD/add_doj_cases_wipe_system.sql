-- ==============================================================================
-- MIGRATION: DOJ Cases (Casos del Departamento de Justicia) Wipe Folders System
-- Permite almacenar y organizar casos del DOJ en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla doj_cases si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'doj_cases' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.doj_cases ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que los casos existentes tengan 'Actual' como carpeta por defecto
UPDATE public.doj_cases 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar filtrados por carpeta de wipe en doj_cases
CREATE INDEX IF NOT EXISTS idx_doj_cases_wipe_folder ON public.doj_cases (wipe_folder);

-- 4. Asegurar que app_settings cuenta con los registros iniciales para Wipes de DOJ Cases
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('doj_cases_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('doj_cases_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Actualizar get_doj_cases() para devolver wipe_folder
DROP FUNCTION IF EXISTS get_doj_cases();
DROP FUNCTION IF EXISTS get_doj_cases(TEXT);

CREATE OR REPLACE FUNCTION get_doj_cases(p_status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  case_number INT,
  title TEXT,
  status TEXT,
  location TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  assigned_avatars TEXT[],
  wipe_folder TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.case_number,
    c.title,
    c.status,
    c.location,
    c.occurred_at,
    c.created_at,
    ARRAY(
      SELECT u.profile_image 
      FROM public.doj_case_assignments ca
      JOIN public.users u ON ca.user_id = u.id
      WHERE ca.case_id = c.id
      LIMIT 3
    ),
    COALESCE(NULLIF(TRIM(c.wipe_folder), ''), 'Actual') AS wipe_folder
  FROM public.doj_cases c
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
  ORDER BY c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_doj_cases(TEXT) TO authenticated;
