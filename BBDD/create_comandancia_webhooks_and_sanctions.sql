-- ==============================================================================
-- COMANDANCIA: DISCORD WEBHOOK PARA FEEDBACKS Y EMISIÓN DE FALTAS LEVES
-- ==============================================================================

-- 1. Insertar valores iniciales por defecto para el Webhook de Feedbacks en app_settings
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_feedback_webhook_url', ''),
  ('discord_feedback_webhook_enabled', 'false'),
  ('discord_feedback_webhook_role_ping', ''),
  ('discord_feedback_bot_name', 'Comandancia • Feedbacks LSPD'),
  ('discord_feedback_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/ia_logo.png'),
  ('discord_feedback_custom_msg', '📥 **NUEVO FEEDBACK REGISTRADO EN COMANDANCIA**')
ON CONFLICT (key) DO NOTHING;

-- 2. Asegurar permisos de lectura y escritura en app_settings para roles de Comandancia y autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO postgres, service_role;

-- 3. Asegurar permisos de ejecución de la RPC de Sanciones para usuarios autenticados
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'create_ia_published_sanction'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.create_ia_published_sanction TO authenticated;
    END IF;
END $$;

-- 4. Asegurar permisos en ia_published_sanctions
GRANT SELECT, INSERT, UPDATE ON TABLE public.ia_published_sanctions TO authenticated;
GRANT ALL ON TABLE public.ia_published_sanctions TO postgres, service_role;

-- 5. Adaptar public.ia_sanctions para admitir Faltas Leves de Sargentos
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'ia_sanctions' 
        AND constraint_name = 'ia_sanctions_sanction_type_check'
    ) THEN
        ALTER TABLE public.ia_sanctions DROP CONSTRAINT ia_sanctions_sanction_type_check;
    END IF;
END $$;

ALTER TABLE public.ia_sanctions ADD COLUMN IF NOT EXISTS is_sargentos BOOLEAN DEFAULT FALSE;

-- 6. Asegurar permisos en ia_subject_profiles y ia_sanctions para usuarios autenticados
GRANT SELECT, INSERT, UPDATE ON TABLE public.ia_subject_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ia_sanctions TO authenticated;
GRANT ALL ON TABLE public.ia_subject_profiles TO postgres, service_role;
GRANT ALL ON TABLE public.ia_sanctions TO postgres, service_role;

-- 7. Actualizar la RPC manage_ia_sanction para gestionar Faltas Leves de Sargentos
CREATE OR REPLACE FUNCTION public.manage_ia_sanction(
  p_action TEXT, -- 'create', 'update', 'delete'
  p_id UUID DEFAULT NULL, -- Requerido para update/delete
  p_subject_id UUID DEFAULT NULL, -- Requerido para create
  p_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_date DATE DEFAULT NULL,
  p_case_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_uid UUID;
  v_is_sargentos BOOLEAN;
BEGIN
  v_uid := auth.uid();
  v_is_sargentos := (p_type ILIKE '%sargento%');

  IF p_action = 'create' THEN
    INSERT INTO public.ia_sanctions (subject_id, sanction_type, description, sanction_date, case_id, created_by, is_sargentos)
    VALUES (p_subject_id, p_type, p_description, p_date, p_case_id, v_uid, v_is_sargentos)
    RETURNING id INTO v_id;
    RETURN v_id;

  ELSIF p_action = 'update' THEN
    UPDATE public.ia_sanctions
    SET 
        sanction_type = COALESCE(p_type, sanction_type),
        description = COALESCE(p_description, description),
        sanction_date = COALESCE(p_date, sanction_date),
        case_id = p_case_id,
        is_sargentos = CASE WHEN p_type IS NOT NULL THEN (p_type ILIKE '%sargento%') ELSE is_sargentos END
    WHERE id = p_id;
    RETURN p_id;

  ELSIF p_action = 'delete' THEN
    DELETE FROM public.ia_sanctions WHERE id = p_id;
    RETURN p_id;
    
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.manage_ia_sanction TO authenticated;

-- 8. Actualizar get_ia_subject_details para incluir campo is_sargentos
CREATE OR REPLACE FUNCTION public.get_ia_subject_details(p_subject_id UUID)
RETURNS JSON AS $$
DECLARE
  v_profile RECORD;
  v_sanctions JSON;
BEGIN
  SELECT * INTO v_profile FROM public.ia_subject_profiles WHERE id = p_subject_id;
  
  SELECT COALESCE(json_agg(json_build_object(
    'id', s.id,
    'type', s.sanction_type,
    'description', s.description,
    'date', s.sanction_date,
    'case_id', s.case_id,
    'case_title', c.title,
    'case_number', c.case_number,
    'created_by_name', u.nombre || ' ' || u.apellido,
    'created_by', s.created_by,
    'is_sargentos', COALESCE(s.is_sargentos, (s.sanction_type ILIKE '%sargento%'))
  ) ORDER BY s.sanction_date DESC), '[]'::json)
  INTO v_sanctions
  FROM public.ia_sanctions s
  LEFT JOIN public.ia_cases c ON s.case_id = c.id
  LEFT JOIN public.users u ON s.created_by = u.id
  WHERE s.subject_id = p_subject_id;
  
  RETURN json_build_object(
    'profile', v_profile,
    'sanctions', v_sanctions
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_ia_subject_details TO authenticated;
