-- 1. Add subdivisions column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subdivisions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Create RPC function to update user subdivisions
CREATE OR REPLACE FUNCTION update_user_subdivisions(
  p_target_user_id UUID,
  p_subdivisions TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_viewer_role app_role;
BEGIN
  -- Get the role of the calling user
  SELECT rol INTO v_viewer_role
  FROM public.users
  WHERE id = auth.uid();

  -- Check if viewer has permission (Detectives, Coordinadores, Administradores, Comisionado)
  IF v_viewer_role NOT IN ('Detective', 'Coordinador', 'Administrador', 'Comisionado') THEN
    RAISE EXCEPTION 'Not authorized to update subdivisions';
  END IF;

  -- Update target user's subdivisions
  UPDATE public.users
  SET subdivisions = p_subdivisions,
      updated_at = NOW()
  WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION update_user_subdivisions TO authenticated;
