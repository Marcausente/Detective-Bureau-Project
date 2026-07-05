CREATE OR REPLACE FUNCTION update_ia_case_details(
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
  v_user_rango TEXT;
  v_creator_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  v_uid := auth.uid();

  -- 1. Get User Role and Rango safely
  SELECT TRIM(rol::text), TRIM(rango::text) INTO v_user_role, v_user_rango FROM public.users WHERE id = v_uid;

  -- 2. Get Case Creator
  SELECT created_by INTO v_creator_id FROM public.ia_cases WHERE id = p_case_id;

  IF v_creator_id IS NULL THEN
      RAISE EXCEPTION 'Case not found';
  END IF;

  -- 3. Check Permissions
  v_is_authorized := (
    (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Director', 'Fundador')) OR
    (v_user_rango IN ('Sheriff', 'Undersheriff', 'Assistant Sheriff', 'Division Chief', 'Comandante', 'Capitan', 'Teniente')) OR
    (v_creator_id = v_uid) OR
    (EXISTS (
      SELECT 1 
      FROM public.ia_case_assignments 
      WHERE case_id = p_case_id AND user_id = v_uid
    ))
  );

  IF v_is_authorized THEN
      -- Proceed with Update
      UPDATE public.ia_cases
      SET 
        title = p_title,
        location = p_location,
        occurred_at = p_occurred_at,
        description = p_description
      WHERE id = p_case_id;
  ELSE
      RAISE EXCEPTION 'Access Denied: You do not have permission to edit this IA case.';
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
