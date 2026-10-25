-- ==============================================================================
-- ACTUALIZACIÓN DE ACCESO DE BANDAS PARA ROL AYUDANTE / DETECTIVE BUREAU
-- Permite que los usuarios con rol 'ayudante' que pertenecen a Detective Bureau
-- puedan listar las bandas (ver nombre, imagen de header y enviar matrices).
-- En la base de datos se ocultan los datos confidenciales (miembros, vehículos, etc.)
-- para usuarios que no sean Detectives, Coordinadores, Comisionado o Administradores.
-- ==============================================================================

-- 1. Actualizar auth_is_gang_authorized()
CREATE OR REPLACE FUNCTION auth_is_gang_authorized() 
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_divisions TEXT[];
    v_subdivisions TEXT[];
    v_has_db_or_gang_unit BOOLEAN;
BEGIN
    SELECT 
        LOWER(TRIM(rol::text)), 
        divisions,
        subdivisions
    INTO v_role, v_divisions, v_subdivisions 
    FROM public.users 
    WHERE id = auth.uid();
    
    -- Verificar si tiene divisiones/subdivisiones de investigación (Detective Bureau, SCUB, GND, Gang Unit)
    v_has_db_or_gang_unit := (
        (v_divisions IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_divisions) d 
            WHERE d ILIKE '%detective bureau%' OR d ILIKE '%scub%' OR d ILIKE '%gang%' OR d ILIKE '%gnd%'
        ))
        OR
        (v_subdivisions IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_subdivisions) s 
            WHERE s ILIKE '%detective bureau%' OR s ILIKE '%scub%' OR s ILIKE '%gang%' OR s ILIKE '%gnd%'
        ))
    );

    RETURN v_role IN ('detective', 'coordinador', 'comisionado', 'administrador', 'admin', 'ayudante') 
           OR v_role ILIKE '%detective%'
           OR COALESCE(v_has_db_or_gang_unit, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auth_is_gang_authorized() TO authenticated, service_role, anon;


-- 2. Actualizar get_gangs_data()
DROP FUNCTION IF EXISTS get_gangs_data();

CREATE OR REPLACE FUNCTION get_gangs_data()
RETURNS TABLE (
    gang_id UUID,
    name TEXT,
    color TEXT,
    zones_image TEXT,
    is_archived BOOLEAN,
    detective_in_charge_1 UUID,
    detective_in_charge_1_name TEXT,
    detective_in_charge_2 UUID,
    detective_in_charge_2_name TEXT,
    vehicles JSONB,
    homes JSONB,
    members JSONB,
    info JSONB,
    incident_count BIGINT,
    outing_count BIGINT,
    case_count BIGINT,
    cases JSONB,
    graffiti JSONB,
    conflicts JSONB
) AS $$
DECLARE
    v_role TEXT;
    v_is_ayudante BOOLEAN := false;
BEGIN
    IF NOT auth_is_gang_authorized() THEN 
        RETURN;
    END IF;

    SELECT LOWER(TRIM(rol::text)) INTO v_role FROM public.users WHERE id = auth.uid();
    
    -- Detectives, Coordinadores, Comisionado y Administradores tienen acceso total
    -- Cualquier otro (incluyendo rol ayudante) sólo recibe los datos básicos para enviar matrices
    IF v_role = 'ayudante' OR (
        v_role NOT IN ('detective', 'coordinador', 'comisionado', 'administrador', 'admin') 
        AND v_role NOT ILIKE '%detective%'
    ) THEN
        v_is_ayudante := true;
    END IF;

    -- Si es ayudante / no autorizado para inteligencia, solo devuelve nombre, color, imagen de mapa y estado
    IF v_is_ayudante THEN
        RETURN QUERY
        SELECT 
            g.id AS gang_id,
            g.name,
            g.color,
            g.zones_image,
            g.is_archived,
            NULL::UUID AS detective_in_charge_1,
            NULL::TEXT AS detective_in_charge_1_name,
            NULL::UUID AS detective_in_charge_2,
            NULL::TEXT AS detective_in_charge_2_name,
            '[]'::jsonb AS vehicles,
            '[]'::jsonb AS homes,
            '[]'::jsonb AS members,
            '[]'::jsonb AS info,
            0::BIGINT AS incident_count,
            0::BIGINT AS outing_count,
            0::BIGINT AS case_count,
            '[]'::jsonb AS cases,
            '[]'::jsonb AS graffiti,
            '[]'::jsonb AS conflicts
        FROM public.gangs g
        ORDER BY g.created_at ASC;
        RETURN;
    END IF;

    -- Para roles autorizados (Detectives, Coordinadores, Comisionado, Admin): retorna todo
    RETURN QUERY
    SELECT 
        g.id AS gang_id,
        g.name,
        g.color,
        g.zones_image,
        g.is_archived,
        g.detective_in_charge_1,
        (SELECT u.nombre || ' ' || u.apellido FROM public.users u WHERE u.id = g.detective_in_charge_1) AS detective_in_charge_1_name,
        g.detective_in_charge_2,
        (SELECT u.nombre || ' ' || u.apellido FROM public.users u WHERE u.id = g.detective_in_charge_2) AS detective_in_charge_2_name,
        
        -- Vehicles
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           v.id,
                    'model',        v.model,
                    'plate',        v.plate,
                    'owner',        v.owner_name,
                    'notes',        v.notes,
                    'images',       v.images,
                    'added_by_name', COALESCE(
                        (SELECT u.nombre || ' ' || u.apellido FROM public.users u WHERE u.id = v.added_by),
                        'Sin registro'
                    )
                )
            )
            FROM public.gang_vehicles v WHERE v.gang_id = g.id
        ), '[]'::jsonb),

        -- Homes
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           h.id,
                    'owner',        h.owner_name,
                    'notes',        h.address_notes,
                    'images',       h.images,
                    'added_by_name', COALESCE(
                        (SELECT u.nombre || ' ' || u.apellido FROM public.users u WHERE u.id = h.added_by),
                        'Sin registro'
                    )
                )
            )
            FROM public.gang_homes h WHERE h.gang_id = g.id
        ), '[]'::jsonb),

        -- Members
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           m.id,
                    'name',         m.name,
                    'role',         m.role,
                    'photo',        m.photo,
                    'notes',        m.notes,
                    'status',       m.status,
                    'added_by_name', COALESCE(
                        (SELECT u.nombre || ' ' || u.apellido FROM public.users u WHERE u.id = m.added_by),
                        'Sin registro'
                    )
                )
            )
            FROM public.gang_members m WHERE m.gang_id = g.id
        ), '[]'::jsonb),

        -- Info
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',      i.id,
                    'type',    i.type,
                    'content', i.content,
                    'images',  i.images,
                    'author',  (
                        SELECT u.nombre || ' ' || u.apellido
                        FROM public.users u WHERE u.id = i.author_id
                    )
                )
            )
            FROM public.gang_info i WHERE i.gang_id = g.id
        ), '[]'::jsonb),

        -- Counts
        (SELECT COUNT(*) FROM public.incident_gangs ig WHERE ig.gang_id = g.id),
        (SELECT COUNT(*) FROM public.outing_gangs   og WHERE og.gang_id = g.id),
        (SELECT COUNT(*) FROM public.case_gangs     cg WHERE cg.gang_id = g.id),

        -- Linked Cases Collection
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id,
                'case_number', c.case_number,
                'title', c.title,
                'status', c.status,
                'location', c.location,
                'occurred_at', c.occurred_at,
                'created_at', c.created_at
            ) ORDER BY c.created_at DESC)
            FROM public.case_gangs cg
            JOIN public.cases c ON cg.case_id = c.id
            WHERE cg.gang_id = g.id
        ), '[]'::jsonb),

        -- Graffiti Collection
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',            gr.id,
                    'graffiti_image',gr.graffiti_image,
                    'gps_image',     gr.gps_image,
                    'notes',         gr.notes,
                    'created_at',    gr.created_at
                )
            )
            FROM public.gang_graffitis gr WHERE gr.gang_id = g.id
        ), '[]'::jsonb),

        -- Conflicts Collection
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', gc.id,
                'target_gang_id', gc.target_gang_id,
                'target_gang_name', COALESCE(tg.name, gc.target_gang_name),
                'target_gang_color', tg.color,
                'reason', COALESCE(gc.reason, 'Desconocido'),
                'status', COALESCE(gc.status, 'active'),
                'created_at', gc.created_at
            ) ORDER BY (gc.status = 'active') DESC, gc.created_at DESC)
            FROM public.gang_conflicts gc
            LEFT JOIN public.gangs tg ON gc.target_gang_id = tg.id
            WHERE gc.gang_id = g.id
        ), '[]'::jsonb)

    FROM public.gangs g
    ORDER BY g.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_gangs_data() TO authenticated, service_role, anon;
