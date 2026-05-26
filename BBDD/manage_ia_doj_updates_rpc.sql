-- Functions to manage IA and DOJ Case Updates (Edit/Delete)

-- 1. Delete IA Update
DROP FUNCTION IF EXISTS delete_ia_case_update(uuid);
CREATE OR REPLACE FUNCTION delete_ia_case_update(p_update_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.ia_case_updates WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Edit IA Update Content
DROP FUNCTION IF EXISTS update_ia_case_update_content(uuid, text);
CREATE OR REPLACE FUNCTION update_ia_case_update_content(p_update_id UUID, p_content TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_case_updates
  SET content = p_content
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Delete DOJ Update
DROP FUNCTION IF EXISTS delete_doj_case_update(uuid);
CREATE OR REPLACE FUNCTION delete_doj_case_update(p_update_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.doj_case_updates WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Edit DOJ Update Content
DROP FUNCTION IF EXISTS update_doj_case_update_content(uuid, text);
CREATE OR REPLACE FUNCTION update_doj_case_update_content(p_update_id UUID, p_content TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.doj_case_updates
  SET content = p_content
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
