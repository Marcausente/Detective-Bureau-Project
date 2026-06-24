-- 1. Add specialty_subdivision column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS specialty_subdivision TEXT DEFAULT NULL;

-- 2. Create RPC function to update user specialty subdivision
CREATE OR REPLACE FUNCTION update_user_specialty(
  p_target_user_id UUID,
  p_specialty TEXT
)
RETURNS VOID AS $$
DECLARE
  v_viewer_role app_role;
  v_user_subdivisions TEXT[];
BEGIN
  -- Get the role of the calling user
  SELECT rol INTO v_viewer_role
  FROM public.users
  WHERE id = auth.uid();

  -- Check if viewer has permission (Detectives, Coordinadores, Administradores, Comisionado)
  IF v_viewer_role NOT IN ('Detective', 'Coordinador', 'Administrador', 'Comisionado') THEN
    RAISE EXCEPTION 'Not authorized to update specialty';
  END IF;

  -- Get target user's current subdivisions
  SELECT subdivisions INTO v_user_subdivisions
  FROM public.users
  WHERE id = p_target_user_id;

  -- Verify the specialty is one of their subdivisions (or NULL/empty)
  IF p_specialty IS NOT NULL AND p_specialty <> '' AND NOT (p_specialty = ANY(v_user_subdivisions)) THEN
    RAISE EXCEPTION 'Specialty must be one of the user''s subdivisions';
  END IF;

  -- Update target user's specialty
  UPDATE public.users
  SET specialty_subdivision = NULLIF(p_specialty, ''),
      updated_at = NOW()
  WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION update_user_specialty TO authenticated;

-- 3. Update update_user_subdivisions RPC to clear specialty if the new subdivisions list doesn't include it
CREATE OR REPLACE FUNCTION update_user_subdivisions(
  p_target_user_id UUID,
  p_subdivisions TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_viewer_role app_role;
  v_specialty TEXT;
BEGIN
  -- Get the role of the calling user
  SELECT rol INTO v_viewer_role
  FROM public.users
  WHERE id = auth.uid();

  -- Check if viewer has permission (Detectives, Coordinadores, Administradores, Comisionado)
  IF v_viewer_role NOT IN ('Detective', 'Coordinador', 'Administrador', 'Comisionado') THEN
    RAISE EXCEPTION 'Not authorized to update subdivisions';
  END IF;

  -- Get current specialty
  SELECT specialty_subdivision INTO v_specialty
  FROM public.users
  WHERE id = p_target_user_id;

  -- If the specialty is not in the new subdivisions, clear it
  IF v_specialty IS NOT NULL AND NOT (v_specialty = ANY(p_subdivisions)) THEN
    v_specialty := NULL;
  END IF;

  -- Update target user's subdivisions
  UPDATE public.users
  SET subdivisions = p_subdivisions,
      specialty_subdivision = v_specialty,
      updated_at = NOW()
  WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION update_user_subdivisions TO authenticated;

-- 4. Update check_user_self_update trigger to protect specialty_subdivision updates
CREATE OR REPLACE FUNCTION public.check_user_self_update()
RETURNS TRIGGER AS $$
BEGIN
  -- We only restrict actions when the user is updating their own profile directly via PostgREST/client API
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.id THEN
  
    -- 1. Prevent updating their own role (rol)
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      RAISE EXCEPTION 'No puedes cambiar tu propio rol';
    END IF;

    -- 2. Prevent updating their own rank (rango) unless they are authorized roles (Coordinador, Comisionado, Administrador)
    IF NEW.rango IS DISTINCT FROM OLD.rango THEN
      IF OLD.rol NOT IN ('Coordinador', 'Comisionado', 'Administrador') THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar tu rango';
      END IF;
    END IF;

    -- 3. Prevent updating their own divisions unless they are authorized roles
    IF NEW.divisions IS DISTINCT FROM OLD.divisions THEN
      IF OLD.rol NOT IN ('Coordinador', 'Comisionado', 'Administrador') THEN
        RAISE EXCEPTION 'No puedes cambiar tus propias divisiones';
      END IF;
    END IF;

    -- 4. Prevent updating their own subdivisions unless they are authorized roles (Detective, Coordinador, Comisionado, Administrador)
    IF NEW.subdivisions IS DISTINCT FROM OLD.subdivisions THEN
      IF OLD.rol NOT IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar tus subdivisiones';
      END IF;
    END IF;

    -- 5. Prevent updating their own specialty_subdivision unless they are authorized roles (Detective, Coordinador, Comisionado, Administrador)
    IF NEW.specialty_subdivision IS DISTINCT FROM OLD.specialty_subdivision THEN
      IF OLD.rol NOT IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar tu especialidad';
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
