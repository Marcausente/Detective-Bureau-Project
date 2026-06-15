-- 1. Create a trigger function to validate self-updates on public.users
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

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop trigger if it already exists, then create it
DROP TRIGGER IF EXISTS tr_protect_user_roles ON public.users;
CREATE TRIGGER tr_protect_user_roles
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_self_update();
