-- ==============================================================================
-- ACTUALIZACIÓN: AÑADIR COLUMNA CATEGORY Y ACTUALIZAR RPC EN DOJ_DOCUMENTATION
-- ==============================================================================

-- 1. Añadir columna category si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doj_documentation' AND column_name = 'category'
    ) THEN
        ALTER TABLE public.doj_documentation ADD COLUMN category TEXT DEFAULT 'documentation';
    END IF;
END $$;

-- 2. Eliminar firma antigua de manage_doj_documentation para evitar conflictos
DROP FUNCTION IF EXISTS public.manage_doj_documentation(text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.manage_doj_documentation(text, uuid, text, text, text, text);

-- 3. Crear RPC actualizado con soporte para p_category
CREATE OR REPLACE FUNCTION public.manage_doj_documentation(
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
    INSERT INTO public.doj_documentation (title, description, url, category, created_by)
    VALUES (p_title, p_description, p_url, COALESCE(p_category, 'documentation'), auth.uid());
  ELSIF p_action = 'update' THEN
    UPDATE public.doj_documentation
    SET title = p_title, 
        description = p_description, 
        url = p_url, 
        category = COALESCE(p_category, 'documentation')
    WHERE id = p_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.doj_documentation WHERE id = p_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Permisos
GRANT EXECUTE ON FUNCTION public.manage_doj_documentation(text, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_doj_documentation(text, uuid, text, text, text, text) TO service_role;
