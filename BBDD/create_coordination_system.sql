-- ============================================================
-- COORDINATION SYSTEM (TODOS & SANCTIONS)
-- ============================================================

-- 1. Create Coordination To-Do Lists Table
CREATE TABLE IF NOT EXISTS public.coordination_todo_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Coordination To-Do Tasks Table
CREATE TABLE IF NOT EXISTS public.coordination_todo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES public.coordination_todo_lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coordination_todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_todo_tasks ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
DROP POLICY IF EXISTS "Allow authenticated read coordination_todo_lists" ON public.coordination_todo_lists;
CREATE POLICY "Allow authenticated read coordination_todo_lists" ON public.coordination_todo_lists FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write coordination_todo_lists" ON public.coordination_todo_lists;
CREATE POLICY "Allow authenticated write coordination_todo_lists" ON public.coordination_todo_lists FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read coordination_todo_tasks" ON public.coordination_todo_tasks;
CREATE POLICY "Allow authenticated read coordination_todo_tasks" ON public.coordination_todo_tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write coordination_todo_tasks" ON public.coordination_todo_tasks;
CREATE POLICY "Allow authenticated write coordination_todo_tasks" ON public.coordination_todo_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. RPC: get_coordination_todos
CREATE OR REPLACE FUNCTION get_coordination_todos()
RETURNS JSON AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_result JSON;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  -- Verify permissions: Coordinador, Comisionado, Administrador, superadmin
  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination and High Command.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', l.id,
      'title', l.title,
      'description', l.description,
      'created_at', l.created_at,
      'created_by', l.created_by,
      'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Coordinación'),
      'tasks', COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', t.id,
              'content', t.content,
              'is_completed', t.is_completed,
              'created_at', t.created_at
            ) ORDER BY t.created_at ASC
          )
          FROM public.coordination_todo_tasks t
          WHERE t.list_id = l.id
        ),
        '[]'::json
      )
    ) ORDER BY l.created_at DESC
  ) INTO v_result
  FROM public.coordination_todo_lists l
  LEFT JOIN public.users u ON l.created_by = u.id;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: create_coordination_todo_list
CREATE OR REPLACE FUNCTION create_coordination_todo_list(
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_new_id UUID;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  INSERT INTO public.coordination_todo_lists (title, description, created_by)
  VALUES (p_title, p_description, v_uid)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC: update_coordination_todo_list
CREATE OR REPLACE FUNCTION update_coordination_todo_list(
  p_list_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  UPDATE public.coordination_todo_lists
  SET title = p_title, description = p_description
  WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC: delete_coordination_todo_list
CREATE OR REPLACE FUNCTION delete_coordination_todo_list(
  p_list_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  DELETE FROM public.coordination_todo_lists WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. RPC: create_coordination_todo_task
CREATE OR REPLACE FUNCTION create_coordination_todo_task(
  p_list_id UUID,
  p_content TEXT
)
RETURNS UUID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_new_id UUID;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  INSERT INTO public.coordination_todo_tasks (list_id, content, created_by)
  VALUES (p_list_id, p_content, v_uid)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. RPC: toggle_coordination_todo_task
CREATE OR REPLACE FUNCTION toggle_coordination_todo_task(
  p_task_id UUID,
  p_completed BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  UPDATE public.coordination_todo_tasks
  SET is_completed = p_completed
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. RPC: delete_coordination_todo_task
CREATE OR REPLACE FUNCTION delete_coordination_todo_task(
  p_task_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  DELETE FROM public.coordination_todo_tasks WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. RPC: update_coordination_todo_task
CREATE OR REPLACE FUNCTION update_coordination_todo_task(
  p_task_id UUID,
  p_content TEXT
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  UPDATE public.coordination_todo_tasks
  SET content = p_content
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Grants
GRANT EXECUTE ON FUNCTION get_coordination_todos() TO authenticated;
GRANT EXECUTE ON FUNCTION create_coordination_todo_list(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_coordination_todo_list(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_coordination_todo_list(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_coordination_todo_task(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_coordination_todo_task(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_coordination_todo_task(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_coordination_todo_task(UUID, TEXT) TO authenticated;
