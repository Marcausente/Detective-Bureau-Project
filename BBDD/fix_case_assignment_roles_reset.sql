-- ============================================================
-- FIX: Preserve detective roles on assignment update & ensure get_case_details includes role
-- ============================================================

-- 1. Update update_case_assignments to preserve existing assigned detective roles
CREATE OR REPLACE FUNCTION update_case_assignments(
  p_case_id UUID,
  p_assigned_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
BEGIN
  -- Check Permissions
  SELECT u.rol::text INTO v_user_role FROM public.users u WHERE u.id = auth.uid();
  
  IF v_user_role = 'Ayudante' THEN
    RAISE EXCEPTION 'Access Denied: Ayudantes cannot manage assignments.';
  END IF;

  IF v_user_role NOT IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') AND v_user_role NOT ILIKE '%Detective%' THEN
     IF v_user_role NOT IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN
        RAISE EXCEPTION 'Access Denied: You cannot manage assignments.';
     END IF;
  END IF;

  -- 1. Remove assignments that are no longer selected
  IF p_assigned_ids IS NULL OR array_length(p_assigned_ids, 1) IS NULL THEN
    DELETE FROM public.case_assignments WHERE case_id = p_case_id;
  ELSE
    DELETE FROM public.case_assignments 
    WHERE case_id = p_case_id 
      AND user_id NOT IN (SELECT unnest(p_assigned_ids));
  END IF;

  -- 2. Insert newly added assignments without overwriting existing roles
  IF p_assigned_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_assigned_ids
    LOOP
      INSERT INTO public.case_assignments (case_id, user_id, role)
      VALUES (p_case_id, v_uid, 'Investigador')
      ON CONFLICT (case_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update update_ia_case_assignments to preserve existing detective roles
CREATE OR REPLACE FUNCTION update_ia_case_assignments(
  p_case_id UUID,
  p_assigned_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF p_assigned_ids IS NULL OR array_length(p_assigned_ids, 1) IS NULL THEN
    DELETE FROM public.ia_case_assignments WHERE case_id = p_case_id;
  ELSE
    DELETE FROM public.ia_case_assignments 
    WHERE case_id = p_case_id 
      AND user_id NOT IN (SELECT unnest(p_assigned_ids));
  END IF;

  IF p_assigned_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_assigned_ids
    LOOP
      INSERT INTO public.ia_case_assignments (case_id, user_id, role)
      VALUES (p_case_id, v_uid, 'Investigador')
      ON CONFLICT (case_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update update_doj_case_assignments to preserve existing detective roles
CREATE OR REPLACE FUNCTION update_doj_case_assignments(
  p_case_id UUID,
  p_assigned_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF p_assigned_ids IS NULL OR array_length(p_assigned_ids, 1) IS NULL THEN
    DELETE FROM public.doj_case_assignments WHERE case_id = p_case_id;
  ELSE
    DELETE FROM public.doj_case_assignments 
    WHERE case_id = p_case_id 
      AND user_id NOT IN (SELECT unnest(p_assigned_ids));
  END IF;

  IF p_assigned_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_assigned_ids
    LOOP
      INSERT INTO public.doj_case_assignments (case_id, user_id, role)
      VALUES (p_case_id, v_uid, 'Investigador')
      ON CONFLICT (case_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Recreate get_case_details ensuring role is always present
CREATE OR REPLACE FUNCTION get_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_uid UUID;
  v_case RECORD;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
  v_incidents JSON;
  v_outings JSON;
  v_complaints JSON;
  v_is_authorized BOOLEAN;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();

  -- 1. Check if Case Exists
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN
     RAISE EXCEPTION 'Case not found';
  END IF;

  -- 2. Authorization Check
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  v_is_authorized :=
      (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR
      (v_user_role ILIKE '%Detective%') OR
      (v_case.created_by = v_uid) OR
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid));

  IF NOT v_is_authorized THEN
     RAISE EXCEPTION 'Access Denied: You do not have permission to view this case.';
  END IF;

  -- 3. Fetch Assignments (with role, defaulting to Investigador)
  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'full_name', u.nombre || ' ' || u.apellido,
    'rank', u.rango,
    'avatar', u.profile_image,
    'role', COALESCE(ca.role, 'Investigador')
  )) INTO v_assignments
  FROM public.case_assignments ca
  JOIN public.users u ON ca.user_id = u.id
  WHERE ca.case_id = p_case_id;

  -- 4. Fetch Updates (ordered DESC)
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'image', cu.image_url,
    'images', cu.images,
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'user_id', cu.author_id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- 5. Fetch Linked Interrogations
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'created_at', i.created_at,
    'subjects', i.subjects
  ) ORDER BY i.created_at DESC) INTO v_interrogations
  FROM public.interrogations i
  WHERE i.case_id = p_case_id;

  -- 6. Fetch Linked Incidents
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'occurred_at', i.occurred_at,
    'location', i.location
  ) ORDER BY i.occurred_at DESC) INTO v_incidents
  FROM public.incidents i
  JOIN public.case_incidents ci ON ci.incident_id = i.id
  WHERE ci.case_id = p_case_id;

  -- 7. Fetch Linked Outings
  SELECT json_agg(json_build_object(
    'id', o.id,
    'title', o.title,
    'occurred_at', o.occurred_at
  ) ORDER BY o.occurred_at DESC) INTO v_outings
  FROM public.outings o
  JOIN public.case_outings co ON co.outing_id = o.id
  WHERE co.case_id = p_case_id;

  -- 8. Fetch Linked Complaints (Denuncias)
  SELECT json_agg(json_build_object(
    'id', d.id,
    'titulo', d.titulo,
    'created_at', d.created_at,
    'status', d.status
  ) ORDER BY d.created_at DESC) INTO v_complaints
  FROM public.denuncias d
  WHERE d.case_id = p_case_id;

  RETURN json_build_object(
    'info', v_case,
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json),
    'incidents', COALESCE(v_incidents, '[]'::json),
    'outings', COALESCE(v_outings, '[]'::json),
    'complaints', COALESCE(v_complaints, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_case_assignments(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ia_case_assignments(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_doj_case_assignments(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_details(UUID) TO authenticated;
