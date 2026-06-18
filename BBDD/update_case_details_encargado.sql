-- UPDATE CASE DETAILS WITH ENCARGADO PERMISSIONS
-- Replaces previous definitions of update_case_details to allow assigned users with role 'Encargado' to edit details.

CREATE OR REPLACE FUNCTION update_case_details(
  p_case_id UUID,
  p_title TEXT,
  p_location TEXT,
  p_occurred_at TIMESTAMP WITH TIME ZONE,
  p_description TEXT
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_creator_id UUID;
  v_is_admin_or_coord BOOLEAN;
  v_is_encargado BOOLEAN;
BEGIN
  v_uid := auth.uid();

  -- 1. Get User Role safely
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;
  
  -- Explicit check for Ayudante
  IF v_user_role = 'Ayudante' THEN
      RAISE EXCEPTION 'Access Denied: Ayudantes cannot edit case details.';
  END IF;

  -- 2. Get Case Creator
  SELECT created_by INTO v_creator_id FROM public.cases WHERE id = p_case_id;

  IF v_creator_id IS NULL THEN
      RAISE EXCEPTION 'Case not found';
  END IF;

  -- 3. Check Permissions
  v_is_admin_or_coord := (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado'));

  -- Check if user is assigned as 'Encargado'
  SELECT EXISTS (
    SELECT 1 
    FROM public.case_assignments 
    WHERE case_id = p_case_id AND user_id = v_uid AND role = 'Encargado'
  ) INTO v_is_encargado;

  -- Allow if Admin/Coord OR if Current User is the Creator OR if they are assigned as 'Encargado'
  IF (v_is_admin_or_coord) OR (v_creator_id = v_uid) OR (v_is_encargado) THEN
      -- Proceed with Update
      UPDATE public.cases
      SET 
        title = p_title,
        location = p_location,
        occurred_at = p_occurred_at,
        description = p_description
      WHERE id = p_case_id;
  ELSE
      RAISE EXCEPTION 'Access Denied: You do not have permission to edit this case.';
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
