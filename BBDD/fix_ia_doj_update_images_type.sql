-- Fix 'images' column type in ia_case_updates and doj_case_updates from text[] to jsonb
-- to resolve "column images is of type text[] but expression is of type jsonb" when saving edits.

-- 1. Convert ia_case_updates.images column to JSONB if it's currently an ARRAY / text[]
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ia_case_updates' 
      AND column_name = 'images' 
      AND (data_type = 'ARRAY' OR udt_name = '_text')
  ) THEN
    ALTER TABLE public.ia_case_updates ALTER COLUMN images TYPE JSONB USING to_jsonb(images);
    ALTER TABLE public.ia_case_updates ALTER COLUMN images SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. Convert doj_case_updates.images column to JSONB if it's currently an ARRAY / text[]
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'doj_case_updates' 
      AND column_name = 'images' 
      AND (data_type = 'ARRAY' OR udt_name = '_text')
  ) THEN
    ALTER TABLE public.doj_case_updates ALTER COLUMN images TYPE JSONB USING to_jsonb(images);
    ALTER TABLE public.doj_case_updates ALTER COLUMN images SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Update add_ia_case_update RPC
DROP FUNCTION IF EXISTS add_ia_case_update(uuid, text, text[]);
DROP FUNCTION IF EXISTS add_ia_case_update(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION add_ia_case_update(
  p_case_id UUID,
  p_content TEXT,
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.ia_case_updates (case_id, author_id, content, images)
  VALUES (p_case_id, auth.uid(), p_content, COALESCE(p_images, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update add_doj_case_update RPC
DROP FUNCTION IF EXISTS add_doj_case_update(uuid, text, text[]);
DROP FUNCTION IF EXISTS add_doj_case_update(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION add_doj_case_update(
  p_case_id UUID,
  p_content TEXT,
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.doj_case_updates (case_id, author_id, content, images)
  VALUES (p_case_id, auth.uid(), p_content, COALESCE(p_images, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update edit RPCs for IA, DOJ, and standard cases
DROP FUNCTION IF EXISTS update_ia_case_update_content(uuid, text);
DROP FUNCTION IF EXISTS update_ia_case_update_content(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION update_ia_case_update_content(
  p_update_id UUID, 
  p_content TEXT, 
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_case_updates
  SET content = p_content,
      images = COALESCE(p_images, '[]'::jsonb)
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS update_doj_case_update_content(uuid, text);
DROP FUNCTION IF EXISTS update_doj_case_update_content(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION update_doj_case_update_content(
  p_update_id UUID, 
  p_content TEXT, 
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.doj_case_updates
  SET content = p_content,
      images = COALESCE(p_images, '[]'::jsonb)
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS update_case_update_content(uuid, text);
DROP FUNCTION IF EXISTS update_case_update_content(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION update_case_update_content(
  p_update_id UUID, 
  p_content TEXT, 
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.case_updates
  SET content = p_content,
      images = COALESCE(p_images, '[]'::jsonb)
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_ia_case_update(UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_doj_case_update(UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_ia_case_update_content(UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_doj_case_update_content(UUID, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_case_update_content(UUID, TEXT, JSONB) TO authenticated, service_role;
