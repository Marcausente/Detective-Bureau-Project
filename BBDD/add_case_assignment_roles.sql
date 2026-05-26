-- 1. Add 'role' column to case_assignments and ia_case_assignments
ALTER TABLE public.case_assignments ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Investigador';
ALTER TABLE public.ia_case_assignments ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Investigador';

-- 2. Update secure get_case_details to include 'role'
CREATE OR REPLACE FUNCTION get_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_uid UUID;
  v_case RECORD;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
  v_is_authorized BOOLEAN;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();

  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN
     RAISE EXCEPTION 'Case not found';
  END IF;

  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  v_is_authorized := 
      (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR
      (v_user_role ILIKE '%Detective%') OR
      (v_case.created_by = v_uid) OR
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid));

  IF NOT v_is_authorized THEN
     RAISE EXCEPTION 'Access Denied: You do not have permission to view this case.';
  END IF;

  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'full_name', u.nombre || ' ' || u.apellido,
    'rank', u.rango,
    'avatar', u.profile_image,
    'role', ca.role
  )) INTO v_assignments
  FROM public.case_assignments ca
  JOIN public.users u ON ca.user_id = u.id
  WHERE ca.case_id = p_case_id;

  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'image', cu.image_url,
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'user_id', u.id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'created_at', i.created_at,
    'subjects', i.subjects
  ) ORDER BY i.created_at DESC) INTO v_interrogations
  FROM public.interrogations i
  WHERE i.case_id = p_case_id;

  RETURN json_build_object(
    'info', v_case,
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update get_ia_case_details to include 'role'
CREATE OR REPLACE FUNCTION get_ia_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_case RECORD;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
BEGIN
  SELECT * INTO v_case FROM public.ia_cases WHERE id = p_case_id;

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

  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'images', cu.images,
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.ia_case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

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

-- 4. Create an RPC to update a specific assignment's role for cases
CREATE OR REPLACE FUNCTION update_case_assignment_role(
  p_case_id UUID,
  p_user_id UUID,
  p_role TEXT
)
RETURNS VOID AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Check Permissions
  SELECT u.rol INTO v_user_role FROM public.users u WHERE u.id = auth.uid();
  
  IF v_user_role NOT IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN
    RAISE EXCEPTION 'Access Denied: You cannot manage assignments.';
  END IF;

  UPDATE public.case_assignments
  SET role = p_role
  WHERE case_id = p_case_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create an RPC to update a specific assignment's role for IA cases
CREATE OR REPLACE FUNCTION update_ia_case_assignment_role(
  p_case_id UUID,
  p_user_id UUID,
  p_role TEXT
)
RETURNS VOID AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Check Permissions
  SELECT u.rol INTO v_user_role FROM public.users u WHERE u.id = auth.uid();
  
  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador') THEN
    RAISE EXCEPTION 'Access Denied: You cannot manage IA assignments.';
  END IF;

  UPDATE public.ia_case_assignments
  SET role = p_role
  WHERE case_id = p_case_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
