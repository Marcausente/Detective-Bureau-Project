-- MIGRATION SCRIPT: GANG UNIT ROLE PERMISSIONS
-- Grants users in the 'Gang Unit' subdivision OR division access to manage gangs, edit/delete incidents, and edit/delete outings.

-- =========================================================================
-- 1. Redefining auth_is_gang_authorized()
-- =========================================================================
-- Now returns TRUE if the user has a permitted role OR has 'Gang Unit' in their divisions/subdivisions.
CREATE OR REPLACE FUNCTION auth_is_gang_authorized() 
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_has_gang_unit BOOLEAN;
BEGIN
    SELECT 
        TRIM(rol::text), 
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_role, v_has_gang_unit 
    FROM public.users 
    WHERE id = auth.uid();
    
    RETURN LOWER(v_role) IN ('detective', 'coordinador', 'comisionado', 'administrador', 'admin') 
           OR COALESCE(v_has_gang_unit, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auth_is_gang_authorized() TO authenticated;


-- =========================================================================
-- 2. Redefining get_incidents_v2()
-- =========================================================================
-- Updates the 'can_delete' field to be TRUE for Admins, Coordinadores, Comisionados, Detectives, OR members of the Gang Unit.
DROP FUNCTION IF EXISTS get_incidents_v2();

CREATE OR REPLACE FUNCTION get_incidents_v2()
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    location TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    tablet_number TEXT,
    description TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    gang_id UUID,
    gang_names TEXT[],
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    is_author BOOLEAN,
    can_delete BOOLEAN
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
        i.id,
        i.title,
        i.location,
        i.occurred_at,
        i.tablet_incident_number,
        i.description,
        i.images,
        i.created_at,
        (SELECT ig.gang_id FROM public.incident_gangs ig WHERE ig.incident_id = i.id LIMIT 1),
        ARRAY(
            SELECT g.name 
            FROM public.incident_gangs ig 
            JOIN public.gangs g ON ig.gang_id = g.id 
            WHERE ig.incident_id = i.id
            ORDER BY g.name
        )::TEXT[],
        COALESCE(u.nombre || ' ' || u.apellido, 'Unknown'),
        COALESCE(u.rango::text, 'N/A'),
        u.profile_image,
        (i.author_id = v_uid) as is_author,
        (
            v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective') 
            OR COALESCE(v_has_gang_unit, FALSE)
        ) as can_delete
    FROM public.incidents i
    LEFT JOIN public.users u ON i.author_id = u.id
    ORDER BY i.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_incidents_v2() TO authenticated;


-- =========================================================================
-- 3. Redefining get_outings()
-- =========================================================================
-- Updates the 'can_delete' field to be TRUE for Admins, Coordinadores, Comisionados, the outing creator, OR members of the Gang Unit.
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
                'rank', u.rango::text,
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
            v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') 
            OR o.created_by = v_uid 
            OR COALESCE(v_has_gang_unit, FALSE)
        ) as can_delete,
        o.tag
    FROM public.outings o
    LEFT JOIN public.users u ON o.created_by = u.id
    ORDER BY o.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_outings() TO authenticated;


-- =========================================================================
-- 4. Redefining get_gang_incidents(p_gang_id UUID)
-- =========================================================================
-- Enables 'can_delete' for Gang Unit subdivision/division members.
CREATE OR REPLACE FUNCTION get_gang_incidents(p_gang_id UUID)
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    location TEXT,
    occurred_at TIMESTAMPTZ,
    tablet_incident_number TEXT,
    description TEXT,
    images JSONB,
    author_id UUID,
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    is_author BOOLEAN,
    can_delete BOOLEAN,
    gang_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_rango TEXT;
    v_user_id UUID;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    SELECT 
        TRIM(rol::text),
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_user_rango, v_has_gang_unit 
    FROM users 
    WHERE id = v_user_id;

    RETURN QUERY
    SELECT
        i.id as record_id,
        i.title,
        i.location,
        i.occurred_at,
        i.tablet_incident_number,
        i.description,
        i.images,
        i.author_id,
        (u.nombre || ' ' || u.apellido) as author_name,
        u.rango::TEXT as author_rank,
        u.profile_image as author_avatar,
        (i.author_id = v_user_id) as is_author,
        (
            i.author_id = v_user_id OR
            v_user_rango IN ('Coordinador', 'Comisionado', 'Administrador', 'Admin') OR
            COALESCE(v_has_gang_unit, FALSE)
        ) as can_delete,
        COALESCE((
            SELECT array_agg(g.name)
            FROM incident_gangs ig2
            JOIN gangs g ON g.id = ig2.gang_id
            WHERE ig2.incident_id = i.id
        ), ARRAY[]::TEXT[]) as gang_names
    FROM incidents i
    JOIN incident_gangs ig ON ig.incident_id = i.id
    LEFT JOIN users u ON i.author_id = u.id
    WHERE ig.gang_id = p_gang_id
    ORDER BY i.occurred_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_gang_incidents(UUID) TO authenticated;


-- =========================================================================
-- 5. Redefining get_gang_outings(p_gang_id UUID)
-- =========================================================================
-- Enables 'can_delete' for Gang Unit subdivision/division members.
DROP FUNCTION IF EXISTS public.get_gang_outings(UUID);

CREATE OR REPLACE FUNCTION public.get_gang_outings(p_gang_id UUID)
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMPTZ,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    author_id UUID,
    is_author BOOLEAN,
    can_delete BOOLEAN,
    detectives JSONB,
    tag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_rango TEXT;
    v_user_id UUID;
    v_has_gang_unit BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    SELECT 
        TRIM(rol::text),
        (
            (subdivisions IS NOT NULL AND 'Gang Unit' = ANY(subdivisions)) OR
            (divisions IS NOT NULL AND 'Gang Unit' = ANY(divisions))
        )
    INTO v_user_rango, v_has_gang_unit 
    FROM users 
    WHERE id = v_user_id;

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
            v_user_rango IN ('Coordinador', 'Comisionado', 'Administrador', 'Admin') OR
            COALESCE(v_has_gang_unit, FALSE)
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
        o.tag
    FROM outings o
    JOIN outing_gangs og ON og.outing_id = o.id
    WHERE og.gang_id = p_gang_id
    ORDER BY o.occurred_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gang_outings(UUID) TO authenticated;


-- =========================================================================
-- 6. Redefining delete_incident(p_id UUID)
-- =========================================================================
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

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR 
       (v_author_id = v_uid) OR
       COALESCE(v_has_gang_unit, FALSE) THEN
        DELETE FROM public.incidents WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this incident.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_incident(UUID) TO authenticated;


-- =========================================================================
-- 7. Redefining delete_outing(p_id UUID)
-- =========================================================================
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

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR 
       (v_creator_id = v_uid) OR
       COALESCE(v_has_gang_unit, FALSE) THEN
        DELETE FROM public.outings WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this outing.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_outing(UUID) TO authenticated;


-- =========================================================================
-- 8. Redefining update_incident(...)
-- =========================================================================
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

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR 
       (v_author_id = v_uid) OR
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


-- =========================================================================
-- 9. Redefining update_outing(...)
-- =========================================================================
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

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR 
       (v_creator_id = v_uid) OR
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
