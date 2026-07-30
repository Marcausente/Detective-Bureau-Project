-- FIX: Ensure get_ia_case_details includes 'user_id' and 'author_id' in updates output
-- This allows the frontend to verify update ownership and render the edit button.

CREATE OR REPLACE FUNCTION get_ia_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_case RECORD;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
BEGIN
  -- Get Case Data
  SELECT * INTO v_case FROM public.ia_cases WHERE id = p_case_id;

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
