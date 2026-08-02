-- =============================================
-- IA CASE PRIVACY & HIDING SYSTEM
-- =============================================

-- 1. Add privacy columns to public.ia_cases
ALTER TABLE public.ia_cases ADD COLUMN IF NOT EXISTS hidden_user_ids UUID[] DEFAULT '{}';
ALTER TABLE public.ia_cases ADD COLUMN IF NOT EXISTS is_hidden_from_all BOOLEAN DEFAULT FALSE;

-- 2. Update create_ia_case function to support privacy parameters
CREATE OR REPLACE FUNCTION create_ia_case(
  p_title TEXT,
  p_location TEXT,
  p_occurred_at TIMESTAMP WITH TIME ZONE,
  p_description TEXT,
  p_assigned_ids UUID[],
  p_image TEXT DEFAULT NULL,
  p_hidden_user_ids UUID[] DEFAULT '{}',
  p_is_hidden_from_all BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_new_case_id UUID;
  v_uid UUID;
BEGIN
  INSERT INTO public.ia_cases (
    title, location, occurred_at, description, initial_image_url, created_by, hidden_user_ids, is_hidden_from_all
  )
  VALUES (
    p_title, p_location, p_occurred_at, p_description, p_image, auth.uid(), COALESCE(p_hidden_user_ids, '{}'), COALESCE(p_is_hidden_from_all, FALSE)
  )
  RETURNING id INTO v_new_case_id;

  IF p_assigned_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_assigned_ids
    LOOP
      INSERT INTO public.ia_case_assignments (case_id, user_id) VALUES (v_new_case_id, v_uid);
    END LOOP;
  END IF;

  RETURN v_new_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_ia_case(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, UUID[], TEXT, UUID[], BOOLEAN) TO authenticated;

-- 3. Update get_ia_cases function to filter out hidden cases for non-admins
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
  is_hidden_from_all BOOLEAN
) AS $$
DECLARE
  v_user_role TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT rol INTO v_user_role FROM public.users WHERE id = v_user_id;

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
    c.hidden_user_ids,
    c.is_hidden_from_all
  FROM public.ia_cases c
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
    AND (
      LOWER(COALESCE(v_user_role, '')) IN ('administrador', 'superadmin', 'admin')
      OR (
        COALESCE(c.is_hidden_from_all, FALSE) = FALSE
        AND NOT (v_user_id = ANY(COALESCE(c.hidden_user_ids, ARRAY[]::UUID[])))
      )
    )
  ORDER BY c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_ia_cases(TEXT) TO authenticated;

-- 4. Update get_ia_case_details function
CREATE OR REPLACE FUNCTION get_ia_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_case RECORD;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
  v_user_role TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT rol INTO v_user_role FROM public.users WHERE id = v_user_id;

  -- Get Case Data
  SELECT * INTO v_case FROM public.ia_cases WHERE id = p_case_id;

  IF v_case.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Visibility check: Administrators can see everything unconditionally.
  -- Non-admins cannot see cases hidden from all or hidden specifically from them.
  IF LOWER(COALESCE(v_user_role, '')) NOT IN ('administrador', 'superadmin', 'admin') THEN
    IF COALESCE(v_case.is_hidden_from_all, FALSE) = TRUE OR (v_user_id = ANY(COALESCE(v_case.hidden_user_ids, ARRAY[]::UUID[]))) THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Get Assignments (including role)
  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'full_name', u.nombre || ' ' || u.apellido,
    'rank', u.rango,
    'avatar', u.profile_image,
    'role', ca.role
  )) INTO v_assignments
  FROM public.ia_case_assignments ca
  JOIN public.users u ON ca.user_id = u.id
  WHERE ca.case_id = p_case_id;

  -- Get Updates (Including user_id and author_id)
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'images', cu.images,
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'user_id', cu.author_id,
    'author_id', cu.author_id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.ia_case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- Get Linked Interrogations
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'created_at', i.created_at,
    'subjects', i.subjects
  ) ORDER BY i.created_at DESC) INTO v_interrogations
  FROM public.ia_interrogations i
  WHERE i.case_id = p_case_id;

  RETURN json_build_object(
    'info', v_case,
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_ia_case_details(UUID) TO authenticated;

-- 5. New function to update case privacy settings
CREATE OR REPLACE FUNCTION update_ia_case_privacy(
  p_case_id UUID,
  p_hidden_user_ids UUID[],
  p_is_hidden_from_all BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_cases
  SET
    hidden_user_ids = COALESCE(p_hidden_user_ids, '{}'),
    is_hidden_from_all = COALESCE(p_is_hidden_from_all, FALSE)
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_ia_case_privacy(UUID, UUID[], BOOLEAN) TO authenticated;

-- 6. Update get_ia_cases_dropdown function
DROP FUNCTION IF EXISTS get_ia_cases_dropdown();

CREATE OR REPLACE FUNCTION get_ia_cases_dropdown()
RETURNS TABLE (
  id UUID,
  title TEXT,
  case_number INT,
  status TEXT
) AS $$
DECLARE
  v_user_role TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT rol INTO v_user_role FROM public.users WHERE id = v_user_id;

  RETURN QUERY
  SELECT i.id, i.title, i.case_number, i.status
  FROM public.ia_cases i
  WHERE (
    LOWER(COALESCE(v_user_role, '')) IN ('administrador', 'superadmin', 'admin')
    OR (
      COALESCE(i.is_hidden_from_all, FALSE) = FALSE
      AND NOT (v_user_id = ANY(COALESCE(i.hidden_user_ids, ARRAY[]::UUID[])))
    )
  )
  ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_ia_cases_dropdown() TO authenticated;
