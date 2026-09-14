-- create_gang_conflicts_system.sql
-- 1. Create table public.gang_conflicts
CREATE TABLE IF NOT EXISTS public.gang_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gang_id UUID NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
    target_gang_id UUID REFERENCES public.gangs(id) ON DELETE SET NULL,
    target_gang_name TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'Desconocido',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS and Policies
ALTER TABLE public.gang_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users on gang_conflicts" ON public.gang_conflicts;

CREATE POLICY "Enable all access for authenticated users on gang_conflicts" 
ON public.gang_conflicts FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 3. RPC: add_gang_conflict
CREATE OR REPLACE FUNCTION add_gang_conflict(
    p_gang_id UUID,
    p_target_gang_id UUID DEFAULT NULL,
    p_target_gang_name TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'Desconocido'
) RETURNS UUID AS $$
DECLARE
    v_target_name TEXT;
    v_conflict_id UUID;
    v_reason TEXT;
BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    IF p_target_gang_id IS NOT NULL THEN
        SELECT name INTO v_target_name FROM public.gangs WHERE id = p_target_gang_id;
    END IF;
    
    IF v_target_name IS NULL OR TRIM(v_target_name) = '' THEN
        v_target_name := COALESCE(TRIM(p_target_gang_name), 'Grupo Desconocido');
    END IF;
    
    v_reason := NULLIF(TRIM(p_reason), '');
    IF v_reason IS NULL THEN
        v_reason := 'Desconocido';
    END IF;

    INSERT INTO public.gang_conflicts (gang_id, target_gang_id, target_gang_name, reason)
    VALUES (p_gang_id, p_target_gang_id, v_target_name, v_reason)
    RETURNING id INTO v_conflict_id;

    RETURN v_conflict_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: update_gang_conflict
CREATE OR REPLACE FUNCTION update_gang_conflict(
    p_conflict_id UUID,
    p_target_gang_id UUID DEFAULT NULL,
    p_target_gang_name TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'Desconocido'
) RETURNS VOID AS $$
DECLARE
    v_target_name TEXT;
    v_reason TEXT;
BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;

    IF p_target_gang_id IS NOT NULL THEN
        SELECT name INTO v_target_name FROM public.gangs WHERE id = p_target_gang_id;
    END IF;

    IF v_target_name IS NULL OR TRIM(v_target_name) = '' THEN
        v_target_name := COALESCE(TRIM(p_target_gang_name), 'Grupo Desconocido');
    END IF;

    v_reason := NULLIF(TRIM(p_reason), '');
    IF v_reason IS NULL THEN
        v_reason := 'Desconocido';
    END IF;

    UPDATE public.gang_conflicts
    SET target_gang_id = p_target_gang_id,
        target_gang_name = v_target_name,
        reason = v_reason,
        updated_at = NOW()
    WHERE id = p_conflict_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update delete_gang_item RPC to handle conflicts
CREATE OR REPLACE FUNCTION delete_gang_item(p_table TEXT, p_id UUID) RETURNS VOID AS $$
BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    IF p_table = 'vehicle' THEN DELETE FROM public.gang_vehicles WHERE id = p_id;
    ELSIF p_table = 'home' THEN DELETE FROM public.gang_homes WHERE id = p_id;
    ELSIF p_table = 'member' THEN DELETE FROM public.gang_members WHERE id = p_id;
    ELSIF p_table = 'info' THEN DELETE FROM public.gang_info WHERE id = p_id;
    ELSIF p_table = 'graffiti' THEN DELETE FROM public.gang_graffitis WHERE id = p_id;
    ELSIF p_table = 'conflict' THEN DELETE FROM public.gang_conflicts WHERE id = p_id;
    END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Redefine get_gangs_data() to load conflicts
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
        -- Vehicles
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', v.id, 'model', v.model, 'plate', v.plate, 'owner', v.owner_name, 'notes', v.notes, 'images', v.images))
            FROM public.gang_vehicles v WHERE v.gang_id = g.id
        ), '[]'::jsonb),
        -- Homes
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', h.id, 'owner', h.owner_name, 'notes', h.address_notes, 'images', h.images))
            FROM public.gang_homes h WHERE h.gang_id = g.id
        ), '[]'::jsonb),
        -- Members
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'photo', m.photo, 'notes', m.notes, 'status', m.status))
            FROM public.gang_members m WHERE m.gang_id = g.id
        ), '[]'::jsonb),
        -- Info
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', i.id, 'type', i.type, 'content', i.content, 'images', i.images, 'author', (SELECT nombre||' '||apellido FROM public.users WHERE id=i.author_id)))
            FROM public.gang_info i WHERE i.gang_id = g.id
        ), '[]'::jsonb),
        -- Counts
        (SELECT COUNT(*) FROM public.incident_gangs ig WHERE ig.gang_id = g.id),
        (SELECT COUNT(*) FROM public.outing_gangs og WHERE og.gang_id = g.id),
        (SELECT COUNT(*) FROM public.case_gangs cg WHERE cg.gang_id = g.id),
        -- Linked Cases
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
            SELECT jsonb_agg(jsonb_build_object(
                'id', gr.id, 
                'graffiti_image', gr.graffiti_image, 
                'gps_image', gr.gps_image, 
                'notes', gr.notes, 
                'created_at', gr.created_at
            ))
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
                'created_at', gc.created_at
            ) ORDER BY gc.created_at DESC)
            FROM public.gang_conflicts gc
            LEFT JOIN public.gangs tg ON gc.target_gang_id = tg.id
            WHERE gc.gang_id = g.id
        ), '[]'::jsonb)
        
    FROM public.gangs g
    ORDER BY g.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION add_gang_conflict TO authenticated;
GRANT EXECUTE ON FUNCTION update_gang_conflict TO authenticated;
GRANT EXECUTE ON FUNCTION delete_gang_item TO authenticated;
GRANT EXECUTE ON FUNCTION get_gangs_data TO authenticated;
