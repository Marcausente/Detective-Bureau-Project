-- =========================================================================
-- ENSURE DOCUMENTATION SUPPORTS: 'documentation', 'resource', 'information'
-- =========================================================================

-- 1. Ensure category column exists and constraint allows all 3 categories
DO $$
BEGIN
    -- Check if column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documentation_posts' AND column_name = 'category'
    ) THEN
        ALTER TABLE public.documentation_posts ADD COLUMN category TEXT DEFAULT 'documentation';
    END IF;

    -- Drop old restrictive constraint if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_category'
    ) THEN
        ALTER TABLE public.documentation_posts DROP CONSTRAINT check_category;
    END IF;

    -- Add updated constraint allowing documentation, resource, and information
    ALTER TABLE public.documentation_posts 
        ADD CONSTRAINT check_category CHECK (category IN ('documentation', 'resource', 'information'));
END $$;

-- 2. Update RPC manage_documentation
DROP FUNCTION IF EXISTS public.manage_documentation(text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.manage_documentation(text, uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.manage_documentation(
  p_action TEXT, -- 'create', 'update', 'delete'
  p_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'documentation'
)
RETURNS VOID AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Get user role
  SELECT rol::text INTO v_user_role FROM public.users WHERE id = auth.uid();

  -- Verify permissions
  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to manage documentation.';
  END IF;

  IF p_action = 'create' THEN
    INSERT INTO public.documentation_posts (title, description, url, author_id, category)
    VALUES (p_title, p_description, p_url, auth.uid(), COALESCE(p_category, 'documentation'));
    
  ELSIF p_action = 'update' THEN
    UPDATE public.documentation_posts
    SET title = p_title, 
        description = p_description, 
        url = p_url, 
        category = COALESCE(p_category, 'documentation')
    WHERE id = p_id;
    
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.documentation_posts WHERE id = p_id;
    
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.manage_documentation(text, uuid, text, text, text, text) TO authenticated;
