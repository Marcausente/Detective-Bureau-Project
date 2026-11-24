-- ==============================================================================
-- FIX: Interrogations Wipe Folder Update & Move Permissions
-- Soluciona el problema de que los interrogatorios no se mueven a otras carpetas
-- de wipe debido a la falta de política RLS de UPDATE y añade una función RPC
-- con SECURITY DEFINER para traslados seguros.
-- ==============================================================================

-- 1. Asegurar columna wipe_folder e índice en interrogations
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

UPDATE public.interrogations 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

CREATE INDEX IF NOT EXISTS idx_interrogations_wipe_folder ON public.interrogations (wipe_folder);

-- 2. Habilitar política de UPDATE en interrogations para usuarios autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'interrogations' 
          AND policyname = 'RLS_Interrogations_Update'
    ) THEN
        CREATE POLICY "RLS_Interrogations_Update" ON public.interrogations
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Función RPC con SECURITY DEFINER para mover interrogatorios de forma garantizada
CREATE OR REPLACE FUNCTION move_interrogations_wipe(
    p_interrogation_ids UUID[] DEFAULT NULL,
    p_target_folder TEXT DEFAULT 'Actual',
    p_source_folder TEXT DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    v_user_role TEXT;
    v_moved_count INT := 0;
    v_clean_target TEXT;
    v_clean_source TEXT;
BEGIN
    -- Verificar rol del usuario que realiza la operación
    SELECT rol::text INTO v_user_role FROM public.users WHERE id = auth.uid();
    IF v_user_role IS NOT NULL AND v_user_role NOT IN ('Administrador', 'Superadmin', 'Coordinador', 'Comisionado', 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Solo los administradores pueden mover interrogatorios entre carpetas de wipe.';
    END IF;

    v_clean_target := COALESCE(NULLIF(TRIM(p_target_folder), ''), 'Actual');

    IF p_interrogation_ids IS NOT NULL AND array_length(p_interrogation_ids, 1) > 0 THEN
        UPDATE public.interrogations
        SET wipe_folder = v_clean_target
        WHERE id = ANY(p_interrogation_ids);
        
        GET DIAGNOSTICS v_moved_count = ROW_COUNT;
    ELSE
        v_clean_source := COALESCE(NULLIF(TRIM(p_source_folder), ''), 'Actual');
        IF v_clean_source = 'Actual' THEN
            UPDATE public.interrogations
            SET wipe_folder = v_clean_target
            WHERE wipe_folder = 'Actual' OR wipe_folder IS NULL OR TRIM(wipe_folder) = '';
        ELSE
            UPDATE public.interrogations
            SET wipe_folder = v_clean_target
            WHERE wipe_folder = v_clean_source;
        END IF;
        
        GET DIAGNOSTICS v_moved_count = ROW_COUNT;
    END IF;

    RETURN v_moved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION move_interrogations_wipe(UUID[], TEXT, TEXT) TO authenticated;

-- 4. Asegurar que get_interrogations() devuelva wipe_folder
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
