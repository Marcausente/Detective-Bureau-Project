-- 1. Añadir la columna is_pinned a la tabla cases
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 2. Modificar la función get_cases para incluir la columna y ordenar
DROP FUNCTION IF EXISTS get_cases(text);

CREATE OR REPLACE FUNCTION get_cases(p_status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  case_number INT,
  title TEXT,
  status TEXT,
  location TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  assigned_avatars TEXT[],
  is_pinned BOOLEAN
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
    COALESCE(
      ARRAY(
        SELECT u.profile_image 
        FROM public.case_assignments ca
        JOIN public.users u ON ca.user_id = u.id
        WHERE ca.case_id = c.id
        LIMIT 3
      ), 
      ARRAY[]::TEXT[]
    ) as assigned_avatars,
    c.is_pinned
  FROM public.cases c
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
  AND (
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND (
            TRIM(u.rol::text) IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')
            OR u.rol::text ILIKE '%Detective%'
        )
      )
      OR
      (c.created_by = auth.uid()) 
      OR
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = c.id AND ca.user_id = auth.uid()))
  )
  ORDER BY c.is_pinned DESC, c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para cambiar el estado de is_pinned de forma segura
CREATE OR REPLACE FUNCTION toggle_case_pin(p_case_id UUID, p_pinned BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- Obtener el rol del usuario actual
    SELECT u.rol INTO v_user_role 
    FROM public.users u 
    WHERE u.id = auth.uid();

    -- Verificar permisos: Detectives, Comisionado, Administradores, Coordinadores
    IF TRIM(v_user_role) IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective') 
       OR v_user_role ILIKE '%Detective%' 
       OR v_user_role ILIKE '%Admin%' THEN
        UPDATE public.cases
        SET is_pinned = p_pinned
        WHERE id = p_case_id;
    ELSE
        RAISE EXCEPTION 'Access denied. You do not have permission to pin cases.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
