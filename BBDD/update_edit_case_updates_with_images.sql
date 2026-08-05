-- Update case update editing RPCs to support saving images along with content

-- 1. Cases (Detective Cases)
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
      images = p_images
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Internal Affairs (IA) Cases
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
      images = p_images
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. DOJ Cases
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
      images = p_images
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
