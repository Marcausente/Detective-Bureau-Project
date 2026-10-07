-- =========================================================================
-- FIX: REBUILD get_gangs_data() WITH CASES, CASE_COUNT & CONFLICTS PRESERVED
-- Also ensures case_gangs table, RLS policies, and get_gang_cases RPC exist
-- =========================================================================

-- 1. Ensure table case_gangs exists
CREATE TABLE IF NOT EXISTS public.case_gangs (
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    gang_id UUID REFERENCES public.gangs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (case_id, gang_id)
);

-- 2. Ensure RLS is active on case_gangs
ALTER TABLE public.case_gangs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read case_gangs" ON public.case_gangs;
CREATE POLICY "Allow read case_gangs" ON public.case_gangs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert case_gangs" ON public.case_gangs;
CREATE POLICY "Allow insert case_gangs" ON public.case_gangs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete case_gangs" ON public.case_gangs;
CREATE POLICY "Allow delete case_gangs" ON public.case_gangs FOR DELETE TO authenticated USING (true);

-- 3. Link and Unlink RPCs
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

-- 4. Get cases linked to a gang RPC
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

-- 5. REBUILD get_gangs_data() - COMPLETE MASTER DEFINITION
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
BEGIN
    IF NOT auth_is_gang_authorized() THEN 
        RETURN;
    END IF;

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
        
        -- Vehicles (with added_by_name)
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

        -- Homes (with added_by_name)
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

        -- Members (with added_by_name and status)
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

        -- Info (with author name)
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

        -- Conflicts Collection (Activos primero, luego finalizados)
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

-- 6. Permissions
GRANT EXECUTE ON FUNCTION link_gang_to_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_gang_from_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gang_cases(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gangs_data() TO authenticated;
