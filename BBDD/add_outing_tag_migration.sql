-- MIGRACIÓN: AGREGAR ETIQUETA OPCIONAL A VIGILANCIAS (OUTINGS)

-- 1. Agregar la columna 'tag' si no existe y su Check Constraint
ALTER TABLE public.outings 
ADD COLUMN IF NOT EXISTS tag TEXT CHECK (tag IS NULL OR tag IN ('ORDINARIA', 'FOXTROT', 'MIKE', 'FUERA DE SERVICIO'));

-- ==========================================
-- 2. Actualizar create_outing
-- ==========================================
DROP FUNCTION IF EXISTS public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[]);
DROP FUNCTION IF EXISTS public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[], TEXT);

CREATE OR REPLACE FUNCTION public.create_outing(
    p_title TEXT,
    p_occurred_at TIMESTAMP WITH TIME ZONE,
    p_reason TEXT,
    p_info_obtained TEXT,
    p_images JSONB DEFAULT '[]'::jsonb,
    p_detective_ids UUID[] DEFAULT '{}',
    p_tag TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_user_id UUID;
BEGIN
    INSERT INTO public.outings (title, occurred_at, reason, info_obtained, images, created_by, tag)
    VALUES (p_title, p_occurred_at, p_reason, p_info_obtained, p_images, auth.uid(), p_tag)
    RETURNING id INTO v_new_id;

    -- Insert Detectives
    IF array_length(p_detective_ids, 1) > 0 THEN
        FOREACH v_user_id IN ARRAY p_detective_ids
        LOOP
            INSERT INTO public.outing_detectives (outing_id, user_id) VALUES (v_new_id, v_user_id);
        END LOOP;
    END IF;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[], TEXT) TO authenticated;

-- ==========================================
-- 3. Actualizar update_outing
-- ==========================================
DROP FUNCTION IF EXISTS public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.update_outing(
    p_outing_id UUID,
    p_title TEXT,
    p_occurred_at TIMESTAMP WITH TIME ZONE,
    p_reason TEXT,
    p_info_obtained TEXT,
    p_images JSONB DEFAULT '[]'::jsonb,
    p_tag TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.outings
    SET title = p_title,
    occurred_at = p_occurred_at,
    reason = p_reason,
    info_obtained = p_info_obtained,
    images = p_images,
    tag = p_tag
    WHERE id = p_outing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- ==========================================
-- 4. Actualizar get_outings
-- ==========================================
DROP FUNCTION IF EXISTS public.get_outings();

CREATE OR REPLACE FUNCTION public.get_outings()
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    detectives JSONB,
    gang_id UUID,       -- Expected by Frontend
    gang_names TEXT[],  -- Expected by Frontend
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    can_delete BOOLEAN,
    tag TEXT            -- Added tag
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(u_auth.rol::text) INTO v_user_role FROM public.users u_auth WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        o.id,
        o.title,
        o.occurred_at,
        o.reason,
        o.info_obtained,
        o.images,
        o.created_at,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', u.id, 
                'name', u.nombre || ' ' || u.apellido, 
                'rank', u.rango,
                'avatar', u.profile_image
            ))
             FROM public.outing_detectives od
             JOIN public.users u ON od.user_id = u.id 
             WHERE od.outing_id = o.id),
            '[]'::jsonb
        ),
        (SELECT og.gang_id FROM public.outing_gangs og WHERE og.outing_id = o.id LIMIT 1),
        ARRAY(
            SELECT g.name 
            FROM public.outing_gangs og 
            JOIN public.gangs g ON og.gang_id = g.id 
            WHERE og.outing_id = o.id
            ORDER BY g.name
        )::TEXT[],
        COALESCE(u.nombre || ' ' || u.apellido, 'Unknown'),
        COALESCE(u.rango::text, 'N/A'),
        u.profile_image,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR o.created_by = v_uid) as can_delete,
        o.tag             -- Added tag
    FROM public.outings o
    LEFT JOIN public.users u ON o.created_by = u.id
    ORDER BY o.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_outings() TO authenticated;

-- ==========================================
-- 5. Actualizar get_gang_outings
-- ==========================================
DROP FUNCTION IF EXISTS public.get_gang_outings(UUID);

CREATE OR REPLACE FUNCTION public.get_gang_outings(p_gang_id UUID)
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMPTZ,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    author_id UUID, -- Creator of the outing
    is_author BOOLEAN,
    can_delete BOOLEAN,
    detectives JSONB, -- List of detectives present
    tag TEXT          -- Added tag
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_rango TEXT;
    v_user_id UUID;
BEGIN
    -- Get current user context
    v_user_id := auth.uid();
    SELECT rol INTO v_user_rango FROM users WHERE id = v_user_id;

    RETURN QUERY
    SELECT
        o.id as record_id,
        o.title,
        o.occurred_at,
        o.reason,
        o.info_obtained,
        o.images,
        o.created_by as author_id,
        (o.created_by = v_user_id) as is_author,
        (
            o.created_by = v_user_id OR
            v_user_rango IN ('Coordinador', 'Comisionado', 'Administrador', 'Admin')
        ) as can_delete,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'id', u.id,
                'name', u.nombre || ' ' || u.apellido,
                'rank', u.rango,
                'avatar', u.profile_image
            ))
            FROM outing_detectives od
            JOIN users u ON u.id = od.user_id
            WHERE od.outing_id = o.id
        ) as detectives,
        o.tag       -- Added tag
    FROM outings o
    JOIN outing_gangs og ON og.outing_id = o.id
    WHERE og.gang_id = p_gang_id
    ORDER BY o.occurred_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gang_outings(UUID) TO authenticated;

-- ==========================================
-- 6. Actualizar get_case_details
-- ==========================================
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

  -- 3. Fetch Assignments (with role)
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

  -- 4. Fetch Updates (ordered DESC, with images array and single image compatibility)
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'images', cu.images,
    'image', cu.image_url,
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

  -- 7. Fetch Linked Outings (with tag)
  SELECT json_agg(json_build_object(
    'id', o.id,
    'title', o.title,
    'occurred_at', o.occurred_at,
    'tag', o.tag
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

  RETURN json_build_object(
    'info', v_case,
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json),
    'incidents', COALESCE(v_incidents, '[]'::json),
    'outings', COALESCE(v_outings, '[]'::json),
    'complaints', COALESCE(v_complaints, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_case_details(UUID) TO authenticated;
