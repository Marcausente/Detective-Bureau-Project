-- ==============================================================================
-- ACTUALIZACIÓN DE VINCULACIÓN ENTRE ASUNTOS INTERNOS (IA) Y PLANTILLA DE AGENTES
-- Permite que las sanciones y perfiles de Asuntos Internos estén ligados al ID
-- inmutable del agente en la plantilla, haciendo que los cambios de placa o rango
-- en la plantilla se sincronicen y reflejen automáticamente.
-- ==============================================================================

-- 1. Asegurar columna plantilla_agent_id e índice en ia_subject_profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ia_subject_profiles' 
          AND column_name = 'plantilla_agent_id'
    ) THEN
        ALTER TABLE public.ia_subject_profiles 
        ADD COLUMN plantilla_agent_id UUID REFERENCES public.plantilla_agents(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ia_subject_profiles_plantilla_agent 
ON public.ia_subject_profiles(plantilla_agent_id);

-- 2. Actualizar get_ia_subjects_full para incluir plantilla_agent_id
CREATE OR REPLACE FUNCTION get_ia_subjects_full()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'nombre', p.nombre,
      'apellido', p.apellido,
      'no_placa', p.no_placa,
      'plantilla_agent_id', p.plantilla_agent_id,
      'created_at', p.created_at,
      'sanctions', COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', s.id,
              'type', s.sanction_type,
              'date', s.sanction_date,
              'is_sargentos', COALESCE(s.is_sargentos, (s.sanction_type ILIKE '%sargento%')),
              'created_at', s.created_at
            ) ORDER BY s.sanction_date DESC
          )
          FROM public.ia_sanctions s
          WHERE s.subject_id = p.id
        ),
        '[]'::json
      )
    ) ORDER BY p.nombre ASC
  ) INTO v_result
  FROM public.ia_subject_profiles p;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_ia_subjects_full TO authenticated;

-- 3. Actualizar create_ia_subject_profile con soporte para plantilla_agent_id
CREATE OR REPLACE FUNCTION create_ia_subject_profile(
  p_nombre TEXT,
  p_apellido TEXT,
  p_no_placa TEXT,
  p_plantilla_agent_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.ia_subject_profiles (nombre, apellido, no_placa, plantilla_agent_id, created_by)
  VALUES (p_nombre, p_apellido, COALESCE(p_no_placa, 'S/P'), p_plantilla_agent_id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_ia_subject_profile TO authenticated;

-- 4. Actualizar update_ia_subject_profile con soporte para plantilla_agent_id
CREATE OR REPLACE FUNCTION update_ia_subject_profile(
  p_id UUID,
  p_nombre TEXT,
  p_apellido TEXT,
  p_no_placa TEXT,
  p_plantilla_agent_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_subject_profiles
  SET 
    nombre = p_nombre,
    apellido = p_apellido,
    no_placa = COALESCE(p_no_placa, 'S/P'),
    plantilla_agent_id = COALESCE(p_plantilla_agent_id, plantilla_agent_id)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_ia_subject_profile TO authenticated;

