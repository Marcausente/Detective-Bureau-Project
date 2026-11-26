-- ==============================================================================
-- MIGRATION: IA Interrogations (Interrogatorios Asuntos Internos) Wipe Folders System
-- Permite almacenar y organizar los interrogatorios de Asuntos Internos en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los agentes regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla ia_interrogations si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ia_interrogations' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.ia_interrogations ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que los interrogatorios existentes tengan 'Actual' como carpeta por defecto
UPDATE public.ia_interrogations 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar filtrados por carpeta de wipe en interrogatorios de IA
CREATE INDEX IF NOT EXISTS idx_ia_interrogations_wipe_folder ON public.ia_interrogations (wipe_folder);

-- 4. Asegurar que app_settings cuenta con los registros iniciales para Wipes de Interrogatorios de IA
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('ia_interrogations_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('ia_interrogations_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Asegurar políticas RLS para permitir UPDATE en ia_interrogations por usuarios autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'ia_interrogations' 
          AND policyname = 'RLS_IA_Interrogations_Update'
    ) THEN
        CREATE POLICY "RLS_IA_Interrogations_Update" ON public.ia_interrogations 
        FOR UPDATE TO authenticated 
        USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Función RPC SECURITY DEFINER para mover interrogatorios de IA entre carpetas de wipe
CREATE OR REPLACE FUNCTION move_ia_interrogations_wipe(
  p_interrogation_ids UUID[] DEFAULT NULL,
  p_target_folder TEXT DEFAULT 'Actual',
  p_source_folder TEXT DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_updated INT := 0;
  v_target TEXT;
BEGIN
  v_target := COALESCE(NULLIF(TRIM(p_target_folder), ''), 'Actual');

  IF p_interrogation_ids IS NOT NULL AND array_length(p_interrogation_ids, 1) > 0 THEN
    UPDATE public.ia_interrogations
    SET wipe_folder = v_target
    WHERE id = ANY(p_interrogation_ids);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_source_folder IS NOT NULL THEN
    IF TRIM(p_source_folder) = 'Actual' THEN
      UPDATE public.ia_interrogations
      SET wipe_folder = v_target
      WHERE wipe_folder = 'Actual' OR wipe_folder IS NULL OR TRIM(wipe_folder) = '';
    ELSE
      UPDATE public.ia_interrogations
      SET wipe_folder = v_target
      WHERE wipe_folder = TRIM(p_source_folder);
    END IF;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    UPDATE public.ia_interrogations
    SET wipe_folder = v_target;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.move_ia_interrogations_wipe(UUID[], TEXT, TEXT) TO authenticated;

-- 7. Actualizar función RPC manage_ia_interrogation para admitir p_wipe_folder
DROP FUNCTION IF EXISTS public.manage_ia_interrogation(TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.manage_ia_interrogation(TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION manage_ia_interrogation(
  p_action TEXT, -- 'create', 'update', 'delete', 'link', 'unlink'
  p_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_date DATE DEFAULT NULL,
  p_agents TEXT DEFAULT NULL,
  p_subjects TEXT DEFAULT NULL,
  p_transcription TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_case_id UUID DEFAULT NULL,
  p_wipe_folder TEXT DEFAULT 'Actual'
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_folder TEXT;
BEGIN
  v_uid := auth.uid();
  v_folder := COALESCE(NULLIF(TRIM(p_wipe_folder), ''), 'Actual');

  IF p_action = 'create' THEN
    INSERT INTO public.ia_interrogations (
        created_by, 
        title, 
        interrogation_date, 
        agents_present, 
        subjects, 
        transcription, 
        media_url, 
        case_id,
        wipe_folder
    )
    VALUES (v_uid, p_title, p_date, p_agents, p_subjects, p_transcription, p_url, p_case_id, v_folder);
    
  ELSIF p_action = 'update' THEN
    UPDATE public.ia_interrogations
    SET 
        title = p_title, 
        interrogation_date = p_date, 
        agents_present = p_agents, 
        subjects = p_subjects, 
        transcription = p_transcription, 
        media_url = p_url,
        wipe_folder = CASE WHEN p_wipe_folder IS NOT NULL THEN v_folder ELSE wipe_folder END
    WHERE id = p_id;
    
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.ia_interrogations WHERE id = p_id;

  ELSIF p_action = 'link' THEN
    UPDATE public.ia_interrogations SET case_id = p_case_id WHERE id = p_id;

  ELSIF p_action = 'unlink' THEN
    UPDATE public.ia_interrogations SET case_id = NULL WHERE id = p_id;

  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.manage_ia_interrogation(TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- 8. Actualizar función RPC get_ia_interrogations() para devolver la columna wipe_folder
DROP FUNCTION IF EXISTS public.get_ia_interrogations(UUID);
DROP FUNCTION IF EXISTS public.get_ia_interrogations();

CREATE OR REPLACE FUNCTION get_ia_interrogations(p_case_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  title TEXT,
  interrogation_date DATE,
  agents_present TEXT,
  subjects TEXT,
  transcription TEXT,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  author_name TEXT,
  linked_case_number INT,
  linked_case_title TEXT,
  can_edit BOOLEAN,
  wipe_folder TEXT
) AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.interrogation_date,
    i.agents_present,
    i.subjects,
    i.transcription,
    i.media_url,
    i.created_at,
    (u.nombre || ' ' || u.apellido) as author_name,
    c.case_number as linked_case_number,
    c.title as linked_case_title,
    (i.created_by = v_uid) as can_edit,
    COALESCE(NULLIF(TRIM(i.wipe_folder), ''), 'Actual') as wipe_folder
  FROM public.ia_interrogations i
  LEFT JOIN public.users u ON i.created_by = u.id
  LEFT JOIN public.ia_cases c ON i.case_id = c.id
  WHERE (p_case_id IS NULL OR i.case_id = p_case_id)
  ORDER BY i.interrogation_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_ia_interrogations(UUID) TO authenticated;
