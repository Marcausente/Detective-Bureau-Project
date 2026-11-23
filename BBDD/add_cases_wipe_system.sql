-- ==============================================================================
-- MIGRATION: Cases Wipe Folders System
-- Permite almacenar y organizar casos en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla cases si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'cases' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.cases ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que los casos existentes tengan 'Actual' como carpeta por defecto
UPDATE public.cases 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar búsquedas y filtrados por carpeta de wipe
CREATE INDEX IF NOT EXISTS idx_cases_wipe_folder ON public.cases (wipe_folder);

-- 4. Asegurar que app_settings cuenta con los registros iniciales para Wipes
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar políticas RLS en app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'app_settings' 
          AND policyname = 'Allow read app_settings for all'
    ) THEN
        CREATE POLICY "Allow read app_settings for all" ON public.app_settings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'app_settings' 
          AND policyname = 'Allow write app_settings for authenticated'
    ) THEN
        CREATE POLICY "Allow write app_settings for authenticated" ON public.app_settings FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Insertar valores iniciales si no existen
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('cases_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('cases_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Actualizar la función RPC get_cases para soportar filtro opcional por wipe_folder
CREATE OR REPLACE FUNCTION get_cases(
  p_status_filter TEXT DEFAULT NULL,
  p_wipe_folder TEXT DEFAULT 'Actual'
)
RETURNS TABLE (
  id UUID,
  case_number INT,
  title TEXT,
  status TEXT,
  location TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  is_pinned BOOLEAN,
  wipe_folder TEXT,
  assigned_avatars TEXT[]
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
    COALESCE(c.is_pinned, false) as is_pinned,
    COALESCE(c.wipe_folder, 'Actual') as wipe_folder,
    ARRAY(
      SELECT u.profile_image 
      FROM public.case_assignments ca
      JOIN public.users u ON ca.user_id = u.id
      WHERE ca.case_id = c.id
      LIMIT 3
    ) as assigned_avatars
  FROM public.cases c
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
    AND (
      p_wipe_folder IS NULL 
      OR c.wipe_folder = p_wipe_folder 
      OR (p_wipe_folder = 'Actual' AND c.wipe_folder IS NULL)
    )
  ORDER BY c.is_pinned DESC NULLS LAST, c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
