-- Fix for IA Case Status RPC
-- Execute this script in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.update_ia_case_status(p_case_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_cases 
  SET status = p_status 
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_ia_case_status(p_case_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_cases 
  SET status = p_status 
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_ia_case_status(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_ia_case_status(UUID, TEXT) TO authenticated, service_role;
