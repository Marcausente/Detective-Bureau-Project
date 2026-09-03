-- ==============================================================================
-- MIGRACIÓN PARA PIN / ANCLAR CASOS DE ASUNTOS INTERNOS (IA)
-- ==============================================================================

-- 1. Añadir la columna is_pinned a la tabla ia_cases
ALTER TABLE public.ia_cases ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
UPDATE public.ia_cases SET is_pinned = FALSE WHERE is_pinned IS NULL;

-- 2. Modificar la función get_ia_cases para incluir is_pinned y ordenar por fijados
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
  is_pinned BOOLEAN
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
    COALESCE(c.is_pinned, FALSE)
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

-- 3. Función para alternar el estado de is_pinned en casos de IA de forma segura
DROP FUNCTION IF EXISTS toggle_ia_case_pin(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION toggle_ia_case_pin(p_case_id UUID, p_pinned BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_user_role TEXT := '';
    v_user_rank TEXT := '';
    v_divisions TEXT[] := ARRAY[]::TEXT[];
    v_subdivisions TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Obtener datos del usuario actual casteando los enums explícitamente a text
    SELECT 
        COALESCE(u.rol::text, ''),
        COALESCE(u.rango::text, ''),
        COALESCE(u.divisions, ARRAY[]::TEXT[]),
        COALESCE(u.subdivisions, ARRAY[]::TEXT[])
    INTO 
        v_user_role,
        v_user_rank,
        v_divisions,
        v_subdivisions
    FROM public.users u
    WHERE u.id = auth.uid();

    -- Verificar permisos: IA, Administradores, Coordinador, Comisionado
    IF v_user_role ILIKE '%Admin%'
       OR LOWER(TRIM(v_user_role)) IN ('administrador', 'coordinador', 'comisionado', 'director', 'fundador')
       OR LOWER(TRIM(v_user_rank)) IN ('internal affairs agent', 'sheriff', 'undersheriff', 'assistant sheriff', 'division chief', 'comandante', 'capitan', 'teniente')
       OR 'Internal Affairs' = ANY(v_divisions)
       OR 'Internal Affairs' = ANY(v_subdivisions)
    THEN
        UPDATE public.ia_cases
        SET is_pinned = p_pinned
        WHERE id = p_case_id;
    ELSE
        RAISE EXCEPTION 'Access denied. You do not have permission to pin IA cases.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION toggle_ia_case_pin(UUID, BOOLEAN) TO authenticated;
