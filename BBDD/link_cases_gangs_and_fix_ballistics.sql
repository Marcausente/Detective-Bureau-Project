-- LINK CASES TO CRIMINAL GROUPS (GANGS) & FIX BALLISTICS COINCIDENCES DISPLAY
-- =========================================================================

-- 1. Create junction table for Case <-> Gangs
CREATE TABLE IF NOT EXISTS public.case_gangs (
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    gang_id UUID REFERENCES public.gangs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (case_id, gang_id)
);

-- 2. Enable RLS
ALTER TABLE public.case_gangs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read case_gangs" ON public.case_gangs;
CREATE POLICY "Allow read case_gangs" ON public.case_gangs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert case_gangs" ON public.case_gangs;
CREATE POLICY "Allow insert case_gangs" ON public.case_gangs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete case_gangs" ON public.case_gangs;
CREATE POLICY "Allow delete case_gangs" ON public.case_gangs FOR DELETE TO authenticated USING (true);


-- ============================================================
-- 3. RPC: Get Available Gangs to Link to Case
-- ============================================================
CREATE OR REPLACE FUNCTION get_available_gangs_to_link(p_case_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    color TEXT,
    zones_image TEXT,
    is_archived BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        g.id,
        g.name,
        g.color,
        g.zones_image,
        g.is_archived
    FROM public.gangs g
    WHERE NOT EXISTS (
        SELECT 1 FROM public.case_gangs cg
        WHERE cg.gang_id = g.id AND cg.case_id = p_case_id
    )
    ORDER BY g.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4. RPCs: Link / Unlink Gang to Case
-- ============================================================
CREATE OR REPLACE FUNCTION link_gang_to_case(p_gang_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.case_gangs (case_id, gang_id)
    VALUES (p_case_id, p_gang_id)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlink_gang_from_case(p_gang_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.case_gangs
    WHERE case_id = p_case_id AND gang_id = p_gang_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5. RPC: Get Cases Linked to a Gang
-- ============================================================
CREATE OR REPLACE FUNCTION get_gang_cases(p_gang_id UUID)
RETURNS TABLE (
    id UUID,
    case_number INT,
    title TEXT,
    status TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.case_number,
        c.title,
        c.status,
        c.occurred_at,
        c.location,
        c.created_at
    FROM public.cases c
    JOIN public.case_gangs cg ON cg.case_id = c.id
    WHERE cg.gang_id = p_gang_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6. RPC: get_available_ballistics_to_link (Fixed field mapping)
-- ============================================================
CREATE OR REPLACE FUNCTION get_available_ballistics_to_link(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
    v_coincidences JSON;
    v_weapons JSON;
    v_bullets JSON;
BEGIN
    -- 1. Coincidences
    SELECT json_agg(json_build_object(
        'weapon_id', w.id,
        'id', w.id,
        'serial_number', w.numero_serie,
        'numero_serie', w.numero_serie,
        'weapon_model', w.modelo,
        'modelo', w.modelo,
        'weapon_owner', w.propietario,
        'propietario', w.propietario,
        'weapon_incident', w.incidente_relacionado,
        'status', COALESCE(m.status, 'Abierta'),
        'bullets_count', (SELECT COUNT(*) FROM public.ballistics_bullets b WHERE LOWER(TRIM(b.numero_serie)) = LOWER(TRIM(w.numero_serie)))
    )) INTO v_coincidences
    FROM public.ballistics_weapons w
    LEFT JOIN public.ballistics_matches m ON m.weapon_id = w.id
    WHERE (
        EXISTS (
            SELECT 1 FROM public.ballistics_bullets b 
            WHERE LOWER(TRIM(b.numero_serie)) = LOWER(TRIM(w.numero_serie))
              AND LOWER(TRIM(w.numero_serie)) != ''
              AND LOWER(TRIM(w.numero_serie)) != 'n/a'
        )
    )
    AND (m.case_id IS NULL OR m.case_id != p_case_id)
    AND (m.status IS NULL OR m.status = 'Abierta');

    -- 2. Weapons not yet linked to this case
    SELECT json_agg(json_build_object(
        'id', w.id,
        'modelo', w.modelo,
        'numero_serie', w.numero_serie,
        'propietario', w.propietario,
        'incidente_relacionado', w.incidente_relacionado,
        'created_at', w.created_at
    ) ORDER BY w.created_at DESC) INTO v_weapons
    FROM public.ballistics_weapons w
    WHERE w.case_id IS NULL OR w.case_id != p_case_id;

    -- 3. Bullets not yet linked to this case
    SELECT json_agg(json_build_object(
        'id', b.id,
        'calibre', b.calibre,
        'numero_serie', b.numero_serie,
        'modelo_arma', b.modelo_arma,
        'incidente_relacionado', b.incidente_relacionado,
        'created_at', b.created_at
    ) ORDER BY b.created_at DESC) INTO v_bullets
    FROM public.ballistics_bullets b
    WHERE b.case_id IS NULL OR b.case_id != p_case_id;

    RETURN json_build_object(
        'coincidences', COALESCE(v_coincidences, '[]'::json),
        'weapons', COALESCE(v_weapons, '[]'::json),
        'bullets', COALESCE(v_bullets, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 7. RPC: get_case_details (Complete with Gangs & Ballistics Fix)
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
  v_complaints JSON;
  v_gangs JSON;
  v_ballistics_coincidences JSON;
  v_ballistics_weapons JSON;
  v_ballistics_bullets JSON;
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
    'role', COALESCE(ca.role, 'Investigador')
  )) INTO v_assignments
  FROM public.case_assignments ca
  JOIN public.users u ON ca.user_id = u.id
  WHERE ca.case_id = p_case_id;

  -- 4. Fetch Updates
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

  -- 8. Fetch Linked Complaints (Denuncias)
  SELECT json_agg(json_build_object(
    'id', d.id,
    'titulo', d.titulo,
    'created_at', d.created_at,
    'status', d.status
  ) ORDER BY d.created_at DESC) INTO v_complaints
  FROM public.denuncias d
  WHERE d.case_id = p_case_id;

  -- 9. Fetch Linked Criminal Groups (Gangs)
  SELECT json_agg(json_build_object(
    'id', g.id,
    'name', g.name,
    'color', g.color,
    'zones_image', g.zones_image,
    'is_archived', g.is_archived
  ) ORDER BY g.name ASC) INTO v_gangs
  FROM public.gangs g
  JOIN public.case_gangs cg ON cg.gang_id = g.id
  WHERE cg.case_id = p_case_id;

  -- 10. Fetch Linked Ballistics Coincidences (Include BOTH Spanish and English keys + count)
  SELECT json_agg(json_build_object(
    'id', m.id,
    'weapon_id', w.id,
    'serial_number', w.numero_serie,
    'numero_serie', w.numero_serie,
    'weapon_model', w.modelo,
    'modelo', w.modelo,
    'weapon_owner', w.propietario,
    'propietario', w.propietario,
    'weapon_incident', w.incidente_relacionado,
    'status', m.status,
    'motivo_rechazo', m.motivo_rechazo,
    'updated_at', m.updated_at,
    'bullets_count', (
        SELECT COUNT(*)
        FROM public.ballistics_bullets b
        WHERE LOWER(TRIM(b.numero_serie)) = LOWER(TRIM(w.numero_serie))
    ),
    'bullets', (
        SELECT json_agg(json_build_object(
            'id', b.id,
            'incidente', b.incidente_relacionado,
            'calibre', b.calibre,
            'modelo_arma', b.modelo_arma,
            'created_at', b.created_at
        ))
        FROM public.ballistics_bullets b
        WHERE LOWER(TRIM(b.numero_serie)) = LOWER(TRIM(w.numero_serie))
    )
  ) ORDER BY m.updated_at DESC) INTO v_ballistics_coincidences
  FROM public.ballistics_matches m
  JOIN public.ballistics_weapons w ON m.weapon_id = w.id
  WHERE m.case_id = p_case_id;

  -- 11. Fetch Linked Ballistics Weapons
  SELECT json_agg(json_build_object(
    'id', w.id,
    'modelo', w.modelo,
    'numero_serie', w.numero_serie,
    'propietario', w.propietario,
    'incidente_relacionado', w.incidente_relacionado,
    'created_at', w.created_at
  ) ORDER BY w.created_at DESC) INTO v_ballistics_weapons
  FROM public.ballistics_weapons w
  WHERE w.case_id = p_case_id;

  -- 12. Fetch Linked Ballistics Bullets
  SELECT json_agg(json_build_object(
    'id', b.id,
    'calibre', b.calibre,
    'numero_serie', b.numero_serie,
    'modelo_arma', b.modelo_arma,
    'incidente_relacionado', b.incidente_relacionado,
    'created_at', b.created_at
  ) ORDER BY b.created_at DESC) INTO v_ballistics_bullets
  FROM public.ballistics_bullets b
  WHERE b.case_id = p_case_id;

  RETURN json_build_object(
    'info', v_case,
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json),
    'incidents', COALESCE(v_incidents, '[]'::json),
    'outings', COALESCE(v_outings, '[]'::json),
    'complaints', COALESCE(v_complaints, '[]'::json),
    'gangs', COALESCE(v_gangs, '[]'::json),
    'ballistics_coincidences', COALESCE(v_ballistics_coincidences, '[]'::json),
    'ballistics_weapons', COALESCE(v_ballistics_weapons, '[]'::json),
    'ballistics_bullets', COALESCE(v_ballistics_bullets, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION get_available_gangs_to_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION link_gang_to_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_gang_from_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gang_cases(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_ballistics_to_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_details(UUID) TO authenticated;
