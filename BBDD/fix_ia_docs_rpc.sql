-- Fix IA Documentation Ambiguity
-- This script drops the old 5-argument function signature to resolve
-- the "Could not choose the best candidate function" error.

BEGIN;

-- 1. Drop the old function signature (5 parameters)
DROP FUNCTION IF EXISTS public.manage_ia_documentation(text, uuid, text, text, text);

-- 2. Optionally drop the new one (6 parameters) and recreate it to be clean
DROP FUNCTION IF EXISTS public.manage_ia_documentation(text, uuid, text, text, text, text);

-- 3. Re-create the function with category parameter
CREATE OR REPLACE FUNCTION public.manage_ia_documentation(
  p_action TEXT,
  p_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'documentation'
)
RETURNS VOID AS $$
BEGIN
  IF p_action = 'create' THEN
    INSERT INTO public.ia_documentation (title, description, url, category, created_by)
    VALUES (p_title, p_description, p_url, p_category, auth.uid());
  ELSIF p_action = 'update' THEN
    UPDATE public.ia_documentation
    SET title = p_title, description = p_description, url = p_url, category = p_category
    WHERE id = p_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.ia_documentation WHERE id = p_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
