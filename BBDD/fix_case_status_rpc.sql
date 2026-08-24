-- Fix for Standard Case Status RPC (update_case_status and set_case_status)
-- Execute this script in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.update_case_status(p_case_id UUID, p_status TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_rol TEXT;
BEGIN
  -- Check Role (Ayudantes cannot change case status)
  SELECT u.rol::text INTO v_user_rol FROM public.users u WHERE u.id = auth.uid();
  IF v_user_rol = 'Ayudante' THEN
      RAISE EXCEPTION 'Access Denied: Ayudantes cannot change case status.';
  END IF;

  UPDATE public.cases 
  SET status = p_status 
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_case_status(p_case_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM public.update_case_status(p_case_id, p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_case_status(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_case_status(UUID, TEXT) TO authenticated, service_role;
