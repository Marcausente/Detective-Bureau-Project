-- MIGRATION SCRIPT: FIX INCIDENT AND OUTING PERMISSIONS
-- Ensures only the author/creator, high command (Administrador, Coordinador, Comisionado), or members of the Gang Unit (GND) can edit/delete incidents and outings.

-- ==========================================
-- 1. get_incidents_v2
-- ==========================================
DROP FUNCTION IF EXISTS get_incidents_v2();

CREATE OR REPLACE FUNCTION get_incidents_v2()
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    location TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    tablet_incident_number TEXT,
    description TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    is_author BOOLEAN,
    can_delete BOOLEAN,
    gang_id UUID,
    gang_names TEXT[]
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_uid := auth.uid();
    
    SELECT 
        TRIM(u_auth.rol::text),
        (
            (u_auth.subdivisions IS NOT NULL AND 'Gang Unit' = ANY(u_auth.subdivisions)) OR
            (u_auth.divisions IS NOT NULL AND 'Gang Unit' = ANY(u_auth.divisions))
        )
    INTO v_user_role, v_has_gang_unit
    FROM public.users u_auth 
    WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        i.id AS record_id,
        i.title,
        i.location,
        i.occurred_at,
        i.tablet_incident_number,
        i.description,
        i.images,
        i.created_at,
        COALESCE(u.nombre || ' ' || u.apellido, 'Unknown') as author_name,
        COALESCE(u.rango::text, 'N/A') as author_rank,
        u.profile_image as author_avatar,
        (i.author_id = v_uid) as is_author,
        (
            (i.author_id = v_uid) OR
            (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR
            COALESCE(v_has_gang_unit, FALSE)
        ) as can_delete,
        (SELECT ig.gang_id FROM public.incident_gangs ig WHERE ig.incident_id = i.id LIMIT 1),
        ARRAY(
            SELECT g.name 
            FROM public.incident_gangs ig 
            JOIN public.gangs g ON ig.gang_id = g.id 
            WHERE ig.incident_id = i.id
            ORDER BY g.name
        )::TEXT[]
    FROM public.incidents i
    LEFT JOIN public.users u ON i.author_id = u.id
    ORDER BY i.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_incidents_v2() TO authenticated;


-- ==========================================
-- 2. delete_incident
-- ==========================================
DROP FUNCTION IF EXISTS delete_incident(UUID);

CREATE OR REPLACE FUNCTION delete_incident(p_id UUID) 
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_author_id UUID;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_uid := auth.uid();
    
    SELECT 
        TRIM(rol::text),
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_user_role, v_has_gang_unit 
    FROM public.users 
    WHERE id = v_uid;
    
    SELECT author_id INTO v_author_id FROM public.incidents WHERE id = p_id;

    IF (v_author_id = v_uid) OR
       (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR
       COALESCE(v_has_gang_unit, FALSE) THEN
        DELETE FROM public.incidents WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this incident.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_incident(UUID) TO authenticated;


-- ==========================================
-- 3. update_incident
-- ==========================================
DROP FUNCTION IF EXISTS update_incident(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION update_incident(
    p_incident_id UUID,
    p_title TEXT,
    p_location TEXT,
    p_occurred_at TIMESTAMP WITH TIME ZONE,
    p_tablet_number TEXT,
    p_description TEXT,
    p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_author_id UUID;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_uid := auth.uid();
    
    SELECT 
        TRIM(rol::text),
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_user_role, v_has_gang_unit 
    FROM public.users 
    WHERE id = v_uid;
    
    SELECT author_id INTO v_author_id FROM public.incidents WHERE id = p_incident_id;

    IF (v_author_id = v_uid) OR
       (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR
       COALESCE(v_has_gang_unit, FALSE) THEN
        UPDATE public.incidents
        SET title = p_title,
            location = p_location,
            occurred_at = p_occurred_at,
            tablet_incident_number = p_tablet_number,
            description = p_description,
            images = p_images
        WHERE id = p_incident_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You do not have permission to edit this incident.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_incident(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB) TO authenticated;


-- ==========================================
-- 4. get_outings
-- ==========================================
DROP FUNCTION IF EXISTS get_outings();

CREATE OR REPLACE FUNCTION get_outings()
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    detectives JSONB,
    gang_id UUID,
    gang_names TEXT[],
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    can_delete BOOLEAN,
    tag TEXT
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_uid := auth.uid();
    
    SELECT 
        TRIM(u_auth.rol::text),
        (
            (u_auth.subdivisions IS NOT NULL AND 'Gang Unit' = ANY(u_auth.subdivisions)) OR
            (u_auth.divisions IS NOT NULL AND 'Gang Unit' = ANY(u_auth.divisions))
        )
    INTO v_user_role, v_has_gang_unit
    FROM public.users u_auth 
    WHERE u_auth.id = v_uid;

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
        (
            (o.created_by = v_uid) OR
            (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR
            COALESCE(v_has_gang_unit, FALSE)
        ) as can_delete,
        o.tag
    FROM public.outings o
    LEFT JOIN public.users u ON o.created_by = u.id
    ORDER BY o.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_outings() TO authenticated;


-- ==========================================
-- 5. delete_outing
-- ==========================================
DROP FUNCTION IF EXISTS delete_outing(UUID);

CREATE OR REPLACE FUNCTION delete_outing(p_id UUID) 
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_creator_id UUID;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_uid := auth.uid();
    
    SELECT 
        TRIM(rol::text),
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_user_role, v_has_gang_unit 
    FROM public.users 
    WHERE id = v_uid;
    
    SELECT created_by INTO v_creator_id FROM public.outings WHERE id = p_id;

    IF (v_creator_id = v_uid) OR
       (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR
       COALESCE(v_has_gang_unit, FALSE) THEN
        DELETE FROM public.outings WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this outing.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_outing(UUID) TO authenticated;


-- ==========================================
-- 6. update_outing
-- ==========================================
DROP FUNCTION IF EXISTS update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION update_outing(
    p_outing_id UUID,
    p_title TEXT,
    p_occurred_at TIMESTAMP WITH TIME ZONE,
    p_reason TEXT,
    p_info_obtained TEXT,
    p_images JSONB DEFAULT '[]'::jsonb,
    p_tag TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_creator_id UUID;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_uid := auth.uid();
    
    SELECT 
        TRIM(rol::text),
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_user_role, v_has_gang_unit 
    FROM public.users 
    WHERE id = v_uid;
    
    SELECT created_by INTO v_creator_id FROM public.outings WHERE id = p_outing_id;

    IF (v_creator_id = v_uid) OR
       (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR
       COALESCE(v_has_gang_unit, FALSE) THEN
        UPDATE public.outings
        SET title = p_title,
            occurred_at = p_occurred_at,
            reason = p_reason,
            info_obtained = p_info_obtained,
            images = p_images,
            tag = p_tag
        WHERE id = p_outing_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You do not have permission to edit this outing.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT) TO authenticated;
