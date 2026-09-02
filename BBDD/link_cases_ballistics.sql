-- ============================================================
-- LINK BALLISTICS INVESTIGATIONS TO CASES SYSTEM
-- ============================================================

-- 1. Add case_id to ballistics tables
ALTER TABLE public.ballistics_bullets 
    ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL;

ALTER TABLE public.ballistics_weapons 
    ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL;

-- 2. Create Ballistics Matches Table (Coincidencias Balísticas)
CREATE TABLE IF NOT EXISTS public.ballistics_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weapon_id UUID REFERENCES public.ballistics_weapons(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Abierta' CHECK (status IN ('Abierta', 'Con caso', 'Rechazada')),
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    motivo_rechazo TEXT,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_ballistics_weapon_match UNIQUE (weapon_id)
);

-- Enable RLS
ALTER TABLE public.ballistics_matches ENABLE ROW LEVEL SECURITY;

-- Policies for ballistics_matches
DROP POLICY IF EXISTS "Read ballistics_matches allowed for auth" ON public.ballistics_matches;
CREATE POLICY "Read ballistics_matches allowed for auth" 
    ON public.ballistics_matches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert ballistics_matches allowed for auth" ON public.ballistics_matches;
CREATE POLICY "Insert ballistics_matches allowed for auth" 
    ON public.ballistics_matches FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update ballistics_matches allowed for auth" ON public.ballistics_matches;
CREATE POLICY "Update ballistics_matches allowed for auth" 
    ON public.ballistics_matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Delete ballistics_matches allowed for auth" ON public.ballistics_matches;
CREATE POLICY "Delete ballistics_matches allowed for auth" 
    ON public.ballistics_matches FOR DELETE TO authenticated USING (true);


-- ============================================================
-- 3. RPC: get_ballistics_matches
-- ============================================================
CREATE OR REPLACE FUNCTION get_ballistics_matches()
RETURNS TABLE (
    id UUID,
    weapon_id UUID,
    serial_number TEXT,
    status TEXT,
    case_id UUID,
    case_title TEXT,
    case_number INT,
    motivo_rechazo TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    updater_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.weapon_id,
        m.serial_number,
        m.status,
        m.case_id,
        c.title AS case_title,
        c.case_number,
        m.motivo_rechazo,
        m.updated_at,
        m.updated_by,
        (u.nombre || ' ' || u.apellido) AS updater_name
    FROM public.ballistics_matches m
    LEFT JOIN public.cases c ON m.case_id = c.id
    LEFT JOIN public.users u ON m.updated_by = u.id
    ORDER BY m.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4. RPC: set_ballistics_match_status
-- ============================================================
CREATE OR REPLACE FUNCTION set_ballistics_match_status(
    p_weapon_id UUID,
    p_status TEXT,
    p_case_id UUID DEFAULT NULL,
    p_motivo TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_serial TEXT;
    v_uid UUID;
BEGIN
    v_uid := auth.uid();

    -- Get weapon serial number
    SELECT numero_serie INTO v_serial FROM public.ballistics_weapons WHERE id = p_weapon_id;
    IF v_serial IS NULL THEN
        RAISE EXCEPTION 'Arma no encontrada.';
    END IF;

    -- Upsert match record
    INSERT INTO public.ballistics_matches (
        weapon_id,
        serial_number,
        status,
        case_id,
        motivo_rechazo,
        updated_by,
        updated_at
    )
    VALUES (
        p_weapon_id,
        v_serial,
        p_status,
        CASE WHEN p_status = 'Con caso' THEN p_case_id ELSE NULL END,
        CASE WHEN p_status = 'Rechazada' THEN p_motivo ELSE NULL END,
        v_uid,
        NOW()
    )
    ON CONFLICT (weapon_id) DO UPDATE
    SET 
        serial_number = EXCLUDED.serial_number,
        status = EXCLUDED.status,
        case_id = CASE WHEN EXCLUDED.status = 'Con caso' THEN EXCLUDED.case_id ELSE NULL END,
        motivo_rechazo = CASE WHEN EXCLUDED.status = 'Rechazada' THEN EXCLUDED.motivo_rechazo ELSE NULL END,
        updated_by = v_uid,
        updated_at = NOW();

    -- Synchronize linked case on weapon and bullets
    IF p_status = 'Con caso' AND p_case_id IS NOT NULL THEN
        UPDATE public.ballistics_weapons
        SET case_id = p_case_id
        WHERE id = p_weapon_id;

        UPDATE public.ballistics_bullets
        SET case_id = p_case_id
        WHERE LOWER(TRIM(numero_serie)) = LOWER(TRIM(v_serial));
    ELSIF p_status IN ('Abierta', 'Rechazada') THEN
        -- If unlinking the coincidence, clear case_id from the weapon if it was linked to that case
        UPDATE public.ballistics_weapons
        SET case_id = NULL
        WHERE id = p_weapon_id;

        UPDATE public.ballistics_bullets
        SET case_id = NULL
        WHERE LOWER(TRIM(numero_serie)) = LOWER(TRIM(v_serial));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5. RPCs for Individual Bullets / Weapons Linking
-- ============================================================
CREATE OR REPLACE FUNCTION link_ballistics_bullet_to_case(p_bullet_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.ballistics_bullets
    SET case_id = p_case_id
    WHERE id = p_bullet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlink_ballistics_bullet_from_case(p_bullet_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.ballistics_bullets
    SET case_id = NULL
    WHERE id = p_bullet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION link_ballistics_weapon_to_case(p_weapon_id UUID, p_case_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.ballistics_weapons
    SET case_id = p_case_id
    WHERE id = p_weapon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unlink_ballistics_weapon_from_case(p_weapon_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.ballistics_weapons
    SET case_id = NULL
    WHERE id = p_weapon_id;

    -- If there was a match record linked to this case, reset match status to 'Abierta'
    UPDATE public.ballistics_matches
    SET status = 'Abierta', case_id = NULL, updated_at = NOW(), updated_by = auth.uid()
    WHERE weapon_id = p_weapon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6. Update get_ballistics_bullets to include case info
-- ============================================================
DROP FUNCTION IF EXISTS get_ballistics_bullets();
CREATE OR REPLACE FUNCTION get_ballistics_bullets()
RETURNS TABLE (
    id UUID,
    incidente_relacionado TEXT,
    calibre TEXT,
    numero_serie TEXT,
    modelo_arma TEXT,
    case_id UUID,
    case_title TEXT,
    case_number INT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
    can_delete BOOLEAN
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(u_auth.rol::text) INTO v_user_role FROM public.users u_auth WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        b.id,
        b.incidente_relacionado,
        b.calibre,
        b.numero_serie,
        COALESCE(b.modelo_arma, 'N/A') AS modelo_arma,
        b.case_id,
        c.title AS case_title,
        c.case_number,
        b.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR b.author_id = v_uid) AS can_delete
    FROM public.ballistics_bullets b
    LEFT JOIN public.cases c ON b.case_id = c.id
    LEFT JOIN public.users u ON b.author_id = u.id
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 7. Update get_ballistics_weapons to include case info
-- ============================================================
DROP FUNCTION IF EXISTS get_ballistics_weapons();
CREATE OR REPLACE FUNCTION get_ballistics_weapons()
RETURNS TABLE (
    id UUID,
    propietario TEXT,
    incidente_relacionado TEXT,
    modelo TEXT,
    numero_serie TEXT,
    case_id UUID,
    case_title TEXT,
    case_number INT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
    can_delete BOOLEAN
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(u_auth.rol::text) INTO v_user_role FROM public.users u_auth WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        w.id,
        w.propietario,
        w.incidente_relacionado,
        w.modelo,
        w.numero_serie,
        w.case_id,
        c.title AS case_title,
        c.case_number,
        w.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR w.author_id = v_uid) AS can_delete
    FROM public.ballistics_weapons w
    LEFT JOIN public.cases c ON w.case_id = c.id
    LEFT JOIN public.users u ON w.author_id = u.id
    ORDER BY w.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 8. RPC: get_available_ballistics_to_link
-- ============================================================
CREATE OR REPLACE FUNCTION get_available_ballistics_to_link(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
    v_coincidences JSON;
    v_weapons JSON;
    v_bullets JSON;
BEGIN
    -- 1. Coincidences (Weapons that match bullets and are not linked to this case or are open)
    SELECT json_agg(json_build_object(
        'weapon_id', w.id,
        'serial_number', w.numero_serie,
        'weapon_model', w.modelo,
        'weapon_owner', w.propietario,
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
-- 9. Recreate get_case_details to include linked ballistics
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

  -- 9. Fetch Linked Ballistics Coincidences
  SELECT json_agg(json_build_object(
    'id', m.id,
    'weapon_id', w.id,
    'serial_number', w.numero_serie,
    'weapon_model', w.modelo,
    'weapon_owner', w.propietario,
    'weapon_incident', w.incidente_relacionado,
    'status', m.status,
    'motivo_rechazo', m.motivo_rechazo,
    'updated_at', m.updated_at,
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

  -- 10. Fetch Linked Ballistics Weapons (Directly linked)
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

  -- 11. Fetch Linked Ballistics Bullets (Directly linked)
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
    'ballistics_coincidences', COALESCE(v_ballistics_coincidences, '[]'::json),
    'ballistics_weapons', COALESCE(v_ballistics_weapons, '[]'::json),
    'ballistics_bullets', COALESCE(v_ballistics_bullets, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 10. Grant Permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION get_ballistics_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION set_ballistics_match_status(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION link_ballistics_bullet_to_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_ballistics_bullet_from_case(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION link_ballistics_weapon_to_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_ballistics_weapon_from_case(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_ballistics_to_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ballistics_bullets() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ballistics_weapons() TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_details(UUID) TO authenticated;
