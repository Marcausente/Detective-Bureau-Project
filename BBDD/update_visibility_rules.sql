
-- FINAL SAFE VISIBILITY RULES
-- NO PLACEHOLDERS. COPY ENTIRE FILE CONTENT.

-- 1. Update GET_CASES
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
    COALESCE(
      ARRAY(
        SELECT u.profile_image 
        FROM public.case_assignments ca
        JOIN public.users u ON ca.user_id = u.id
        WHERE ca.case_id = c.id
        LIMIT 3
      ), 
      ARRAY[]::TEXT[]
    ) as assigned_avatars
  FROM public.cases c
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
  AND (
      -- 1. High Command Check (Directly checking ENUM as TEXT)
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.rol::text IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')
      )
      OR
      -- 2. Creator
      (c.created_by = auth.uid()) 
      OR
      -- 3. Assigned Agent
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = c.id AND ca.user_id = auth.uid()))
  )
  ORDER BY c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update GET_INTERROGATIONS
DROP FUNCTION IF EXISTS get_interrogations();

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
  can_edit BOOLEAN
) AS $$
DECLARE
  v_uid UUID;
  v_user_fullname TEXT;
  v_is_high_command BOOLEAN;
BEGIN
  v_uid := auth.uid();
  
  -- Get user details
  SELECT (nombre || ' ' || apellido) INTO v_user_fullname FROM public.users WHERE id = v_uid;
  
  -- Check Role
  SELECT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = v_uid 
    AND u.rol::text IN ('Administrador', 'Coordinador', 'Comisionado')
  ) INTO v_is_high_command;

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
    (v_is_high_command OR i.author_id = v_uid) as can_edit
  FROM public.interrogations i
  LEFT JOIN public.users u ON i.author_id = u.id
  WHERE 
    -- VIEW PERMISSIONS
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = v_uid 
        AND u.rol::text IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')
    )
    OR
    (i.author_id = v_uid)
    OR
    (i.agents_present ILIKE '%' || COALESCE(v_user_fullname, '___NOMATCH___') || '%')
    
  ORDER BY i.interrogation_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
