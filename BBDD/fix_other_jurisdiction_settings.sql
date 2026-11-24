-- ==============================================================================
-- FIX: Other Jurisdiction Subjects & Transferred Incidents in app_settings
-- Asegura políticas RLS y RPCs con SECURITY DEFINER para guardar y cargar
-- la lista de personas de otra jurisdicción y los informes traspasados de forma
-- persistente sin bloqueos por permisos.
-- ==============================================================================

-- 1. Asegurar que la tabla app_settings existe
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS y crear políticas completas para authenticated
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read app_settings for all" ON public.app_settings;
    DROP POLICY IF EXISTS "Allow read access for all" ON public.app_settings;
    CREATE POLICY "Allow read app_settings for all" 
      ON public.app_settings FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow write app_settings for authenticated" ON public.app_settings;
    DROP POLICY IF EXISTS "Allow insert for admins" ON public.app_settings;
    DROP POLICY IF EXISTS "Allow update for admins" ON public.app_settings;
    CREATE POLICY "Allow write app_settings for authenticated" 
      ON public.app_settings FOR ALL TO authenticated 
      USING (true) WITH CHECK (true);
END $$;

-- 3. RPC con SECURITY DEFINER para guardar los sujetos de Otra Jurisdicción
CREATE OR REPLACE FUNCTION save_other_jurisdiction_subjects(p_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('other_jurisdiction_subjects', COALESCE(p_text, ''), NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_other_jurisdiction_subjects(TEXT) TO authenticated;

-- 4. RPC con SECURITY DEFINER para guardar la lista de incidentes traspasados
CREATE OR REPLACE FUNCTION save_transferred_incidents(p_json_array TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('incidents_transferred_jurisdiction', COALESCE(p_json_array, '[]'), NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_transferred_incidents(TEXT) TO authenticated;
