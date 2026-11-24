-- ==============================================================================
-- MIGRATION: IA Cases (Casos de Asuntos Internos) Wipe Folders System
-- Permite almacenar y organizar casos de IA en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla ia_cases si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ia_cases' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.ia_cases ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que los casos existentes tengan 'Actual' como carpeta por defecto
UPDATE public.ia_cases 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar filtrados por carpeta de wipe en ia_cases
CREATE INDEX IF NOT EXISTS idx_ia_cases_wipe_folder ON public.ia_cases (wipe_folder);

-- 4. Asegurar que app_settings cuenta con los registros iniciales para Wipes de IA Cases
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('ia_cases_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('ia_cases_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Actualizar get_ia_cases() para devolver wipe_folder
DROP FUNCTION IF EXISTS get_ia_cases();
DROP FUNCTION IF EXISTS get_ia_cases(TEXT);

CREATE OR REPLACE FUNCTION get_ia_cases(p_status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  case_number INT,
  title TEXT,
  status TEXT,
  location TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  assigned_avatars TEXT[],
  hidden_user_ids UUID[],
  is_hidden_from_all BOOLEAN,
  is_pinned BOOLEAN,
  wipe_folder TEXT
) AS $$
DECLARE
  v_user_role_text TEXT := '';
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(u.rol::text, '') INTO v_user_role_text FROM public.users u WHERE u.id = v_user_id;
  END IF;

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
      FROM public.ia_case_assignments ca
      JOIN public.users u ON ca.user_id = u.id
      WHERE ca.case_id = c.id
      LIMIT 3
    ),
    COALESCE(c.hidden_user_ids, '{}'::UUID[]),
    COALESCE(c.is_hidden_from_all, FALSE),
    COALESCE(c.is_pinned, FALSE),
    COALESCE(NULLIF(TRIM(c.wipe_folder), ''), 'Actual') AS wipe_folder
  FROM public.ia_cases c
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
    AND (
      LOWER(v_user_role_text) IN ('administrador', 'superadmin', 'admin')
      OR (
        c.is_hidden_from_all IS NOT TRUE
        AND (
          c.hidden_user_ids IS NULL
          OR v_user_id IS NULL
          OR NOT (c.hidden_user_ids @> ARRAY[v_user_id])
        )
      )
    )
  ORDER BY COALESCE(c.is_pinned, FALSE) DESC, c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_ia_cases(TEXT) TO authenticated;
