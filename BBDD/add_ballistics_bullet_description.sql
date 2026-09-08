-- ============================================================
-- ADD OPTIONAL INCIDENT / COLLECTION DESCRIPTION TO BULLETS
-- (AÑADIR DESCRIPCIÓN OPCIONAL DEL INCIDENTE / RECOGIDA A BALAS)
-- ============================================================

-- 1. Add descripcion_incidente column to ballistics_bullets if not exists
ALTER TABLE public.ballistics_bullets 
    ADD COLUMN IF NOT EXISTS descripcion_incidente TEXT DEFAULT NULL;

-- 2. Drop old functions to avoid signature conflicts
DROP FUNCTION IF EXISTS get_ballistics_bullets();
DROP FUNCTION IF EXISTS create_ballistics_bullet(text, text, text);
DROP FUNCTION IF EXISTS create_ballistics_bullet(text, text, text, text);
DROP FUNCTION IF EXISTS create_ballistics_bullet(text, text, text, text, text);
DROP FUNCTION IF EXISTS create_ballistics_bullets_batch(text, jsonb);
DROP FUNCTION IF EXISTS create_ballistics_bullets_batch(text, jsonb, text);
DROP FUNCTION IF EXISTS update_ballistics_bullet(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS update_ballistics_bullet(uuid, text, text, text, text, text);

-- 3. Create Seized Bullet (with optional incident description)
CREATE OR REPLACE FUNCTION create_ballistics_bullet(
    p_incidente TEXT,
    p_calibre TEXT DEFAULT 'N/A',
    p_num_serie TEXT DEFAULT '',
    p_modelo_arma TEXT DEFAULT 'N/A',
    p_descripcion_incidente TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.ballistics_bullets (
        incidente_relacionado, 
        calibre, 
        numero_serie, 
        modelo_arma, 
        descripcion_incidente,
        author_id
    )
    VALUES (
        p_incidente, 
        COALESCE(NULLIF(TRIM(p_calibre), ''), 'N/A'), 
        p_num_serie, 
        COALESCE(NULLIF(TRIM(p_modelo_arma), ''), 'N/A'), 
        NULLIF(TRIM(p_descripcion_incidente), ''),
        auth.uid()
    )
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Batch Create Bullets (with optional incident description)
CREATE OR REPLACE FUNCTION create_ballistics_bullets_batch(
    p_incidente TEXT,
    p_bullets JSONB,
    p_descripcion_incidente TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_item JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_bullets)
    LOOP
        INSERT INTO public.ballistics_bullets (
            incidente_relacionado,
            calibre,
            numero_serie,
            modelo_arma,
            descripcion_incidente,
            author_id
        ) VALUES (
            p_incidente,
            COALESCE(NULLIF(TRIM(v_item->>'calibre'), ''), 'N/A'),
            v_item->>'num_serie',
            COALESCE(NULLIF(TRIM(v_item->>'modelo_arma'), ''), 'N/A'),
            NULLIF(TRIM(COALESCE(v_item->>'descripcion_incidente', p_descripcion_incidente, '')), ''),
            auth.uid()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update Seized Bullet (with optional incident description)
CREATE OR REPLACE FUNCTION update_ballistics_bullet(
    p_id UUID,
    p_incidente TEXT,
    p_calibre TEXT DEFAULT 'N/A',
    p_num_serie TEXT DEFAULT '',
    p_modelo_arma TEXT DEFAULT 'N/A',
    p_descripcion_incidente TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_author_id UUID;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;
    SELECT author_id INTO v_author_id FROM public.ballistics_bullets WHERE id = p_id;

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR (v_author_id = v_uid) THEN
        UPDATE public.ballistics_bullets
        SET 
            incidente_relacionado = p_incidente,
            calibre = COALESCE(NULLIF(TRIM(p_calibre), ''), 'N/A'),
            numero_serie = p_num_serie,
            modelo_arma = COALESCE(NULLIF(TRIM(p_modelo_arma), ''), 'N/A'),
            descripcion_incidente = NULLIF(TRIM(p_descripcion_incidente), '')
        WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You cannot edit this bullet record.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Get Seized Bullets (including descripcion_incidente)
CREATE OR REPLACE FUNCTION get_ballistics_bullets()
RETURNS TABLE (
    id UUID,
    incidente_relacionado TEXT,
    calibre TEXT,
    numero_serie TEXT,
    modelo_arma TEXT,
    descripcion_incidente TEXT,
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
        b.descripcion_incidente,
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

-- 7. Update get_available_ballistics_to_link
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
        'descripcion_incidente', b.descripcion_incidente,
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

-- 8. Update get_case_details
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

  -- 10. Fetch Linked Ballistics Coincidences
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
            'descripcion_incidente', b.descripcion_incidente,
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
    'descripcion_incidente', b.descripcion_incidente,
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

-- 9. Grant Permissions
GRANT EXECUTE ON FUNCTION create_ballistics_bullet(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_ballistics_bullets_batch(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ballistics_bullet(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ballistics_bullets() TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_ballistics_to_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_details(UUID) TO authenticated;
