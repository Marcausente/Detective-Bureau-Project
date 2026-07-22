-- ============================================================
-- COORDINATION SANCTIONS SYSTEM
-- ============================================================

-- 1. Create Coordination Sanctions Table
CREATE TABLE IF NOT EXISTS public.coordination_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  badge_no TEXT,
  sanction_type TEXT NOT NULL CHECK (sanction_type IN ('Aviso', 'Sanción Leve', 'Sanción Media', 'Sanción Grave', 'Expulsión')),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coordination_sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read coordination_sanctions" ON public.coordination_sanctions;
CREATE POLICY "Allow authenticated read coordination_sanctions" ON public.coordination_sanctions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write coordination_sanctions" ON public.coordination_sanctions;
CREATE POLICY "Allow authenticated write coordination_sanctions" ON public.coordination_sanctions FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2. RPC: get_coordination_sanctions
CREATE OR REPLACE FUNCTION get_coordination_sanctions()
RETURNS JSON AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_result JSON;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'agent_name', s.agent_name,
      'badge_no', s.badge_no,
      'sanction_type', s.sanction_type,
      'reason', s.reason,
      'created_at', s.created_at,
      'creator_name', COALESCE(u_creator.nombre || ' ' || u_creator.apellido, 'Coordinación'),
      'agent_avatar', u_agent.profile_image,
      'agent_rank', u_agent.rango
    ) ORDER BY s.created_at DESC
  ) INTO v_result
  FROM public.coordination_sanctions s
  LEFT JOIN public.users u_creator ON s.created_by = u_creator.id
  LEFT JOIN public.users u_agent ON s.user_id = u_agent.id;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: create_coordination_sanction
CREATE OR REPLACE FUNCTION create_coordination_sanction(
  p_user_id UUID,
  p_sanction_type TEXT,
  p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_agent RECORD;
  v_new_id UUID;
BEGIN
  v_uid := auth.uid();
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  IF v_user_role NOT IN ('Coordinador', 'Comisionado', 'Administrador', 'superadmin') 
     AND v_user_role NOT ILIKE '%Coordinad%' AND v_user_role NOT ILIKE '%Admin%' THEN
    RAISE EXCEPTION 'Access Denied: Restricted to Coordination.';
  END IF;

  SELECT * INTO v_agent FROM public.users WHERE id = p_user_id;
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Agent not found.';
  END IF;

  INSERT INTO public.coordination_sanctions (
    user_id,
    agent_name,
    badge_no,
    sanction_type,
    reason,
    created_by
  ) VALUES (
    p_user_id,
    COALESCE(v_agent.rango || ' ', '') || v_agent.nombre || ' ' || v_agent.apellido,
    v_agent.no_placa,
    p_sanction_type,
    p_reason,
    v_uid
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: delete_coordination_sanction
CREATE OR REPLACE FUNCTION delete_coordination_sanction(
  p_sanction_id UUID
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

  DELETE FROM public.coordination_sanctions WHERE id = p_sanction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Grants
GRANT EXECUTE ON FUNCTION get_coordination_sanctions() TO authenticated;
GRANT EXECUTE ON FUNCTION create_coordination_sanction(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_coordination_sanction(UUID) TO authenticated;
