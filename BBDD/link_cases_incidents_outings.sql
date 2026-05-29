-- LINK CASES TO INCIDENTS AND OUTINGS SYSTEM
-- Creates junction tables and RPCs to link incidents/outings to cases

-- ============================================================
-- 1. Junction Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.case_incidents (
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (case_id, incident_id)
);

CREATE TABLE IF NOT EXISTS public.case_outings (
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    outing_id UUID REFERENCES public.outings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (case_id, outing_id)
);

-- Enable RLS
ALTER TABLE public.case_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_outings ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated can read/write
DROP POLICY IF EXISTS "Allow read case_incidents" ON public.case_incidents;
CREATE POLICY "Allow read case_incidents" ON public.case_incidents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert case_incidents" ON public.case_incidents;
CREATE POLICY "Allow insert case_incidents" ON public.case_incidents FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete case_incidents" ON public.case_incidents;
CREATE POLICY "Allow delete case_incidents" ON public.case_incidents FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read case_outings" ON public.case_outings;
CREATE POLICY "Allow read case_outings" ON public.case_outings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert case_outings" ON public.case_outings;
CREATE POLICY "Allow insert case_outings" ON public.case_outings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete case_outings" ON public.case_outings;
CREATE POLICY "Allow delete case_outings" ON public.case_outings FOR DELETE TO authenticated USING (true);


-- ============================================================
-- 2. Get Available Incidents to Link (not yet linked to a given case)
-- ============================================================
CREATE OR REPLACE FUNCTION get_available_incidents_to_link(p_case_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    location TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.title,
        i.occurred_at,
        i.location
    FROM public.incidents i
    WHERE NOT EXISTS (
        SELECT 1 FROM public.case_incidents ci
        WHERE ci.incident_id = i.id AND ci.case_id = p_case_id
    )
    ORDER BY i.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. Get Available Outings to Link (not yet linked to a given case)
-- ============================================================
CREATE OR REPLACE FUNCTION get_available_outings_to_link(p_case_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.title,
        o.occurred_at
    FROM public.outings o
    WHERE NOT EXISTS (
        SELECT 1 FROM public.case_outings co
        WHERE co.outing_id = o.id AND co.case_id = p_case_id
    )
    ORDER BY o.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4. Link / Unlink Incident to Case
-- ============================================================
CREATE OR REPLACE FUNCTION link_incident_to_case(p_incident_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.case_incidents (case_id, incident_id)
    VALUES (p_case_id, p_incident_id)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlink_incident_from_case(p_incident_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.case_incidents
    WHERE case_id = p_case_id AND incident_id = p_incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5. Link / Unlink Outing to Case
-- ============================================================
CREATE OR REPLACE FUNCTION link_outing_to_case(p_outing_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.case_outings (case_id, outing_id)
    VALUES (p_case_id, p_outing_id)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlink_outing_from_case(p_outing_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.case_outings
    WHERE case_id = p_case_id AND outing_id = p_outing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6. Update get_case_details to include linked incidents and outings
-- ============================================================
CREATE OR REPLACE FUNCTION get_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_uid UUID;
  v_case RECORD;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
  v_incidents JSON;
  v_outings JSON;
  v_is_authorized BOOLEAN;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();

  -- 1. Check if Case Exists
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN
     RAISE EXCEPTION 'Case not found';
  END IF;

  -- 2. Authorization Check
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  v_is_authorized :=
      (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR
      (v_user_role ILIKE '%Detective%') OR
      (v_case.created_by = v_uid) OR
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid));

  IF NOT v_is_authorized THEN
     RAISE EXCEPTION 'Access Denied: You do not have permission to view this case.';
  END IF;

  -- 3. Fetch Assignments
  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'full_name', u.nombre || ' ' || u.apellido,
    'rank', u.rango,
    'avatar', u.profile_image,
    'role', ca.role
  )) INTO v_assignments
  FROM public.case_assignments ca
  JOIN public.users u ON ca.user_id = u.id
  WHERE ca.case_id = p_case_id;

  -- 4. Fetch Updates (ordered DESC)
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'image', cu.image_url,
    'images', cu.images,
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'user_id', cu.author_id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- 5. Fetch Linked Interrogations
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'created_at', i.created_at,
    'subjects', i.subjects
  ) ORDER BY i.created_at DESC) INTO v_interrogations
  FROM public.interrogations i
  WHERE i.case_id = p_case_id;

  -- 6. Fetch Linked Incidents
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'occurred_at', i.occurred_at,
    'location', i.location
  ) ORDER BY i.occurred_at DESC) INTO v_incidents
  FROM public.incidents i
  JOIN public.case_incidents ci ON ci.incident_id = i.id
  WHERE ci.case_id = p_case_id;

  -- 7. Fetch Linked Outings
  SELECT json_agg(json_build_object(
    'id', o.id,
    'title', o.title,
    'occurred_at', o.occurred_at
  ) ORDER BY o.occurred_at DESC) INTO v_outings
  FROM public.outings o
  JOIN public.case_outings co ON co.outing_id = o.id
  WHERE co.case_id = p_case_id;

  RETURN json_build_object(
    'info', v_case,
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json),
    'incidents', COALESCE(v_incidents, '[]'::json),
    'outings', COALESCE(v_outings, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
