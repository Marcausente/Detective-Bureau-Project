-- Migration: Add Detectives in Charge to Gang Syndicates

-- 1. Add columns to public.gangs table if they do not exist
ALTER TABLE public.gangs ADD COLUMN IF NOT EXISTS detective_in_charge_1 UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.gangs ADD COLUMN IF NOT EXISTS detective_in_charge_2 UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Redefine get_gangs_data() to load detective IDs and names
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
    graffiti JSONB
) AS $$
BEGIN
    IF NOT auth_is_gang_authorized() THEN 
        RETURN; -- Validate return empty if not authorized
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
        -- Counts (Using junction tables to support multiple gangs linked to a single incident/outing)
        (SELECT COUNT(*) FROM public.incident_gangs ig WHERE ig.gang_id = g.id),
        (SELECT COUNT(*) FROM public.outing_gangs og WHERE og.gang_id = g.id),
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
        ), '[]'::jsonb)
        
    FROM public.gangs g
    ORDER BY g.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_gangs_data TO authenticated;

-- 3. Drop existing create_gang function overload and redefine to support detective_in_charge columns
DROP FUNCTION IF EXISTS create_gang(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_gang(TEXT, TEXT, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION create_gang(
    p_name TEXT,
    p_color TEXT,
    p_zones_image TEXT,
    p_detective_in_charge_1 UUID DEFAULT NULL,
    p_detective_in_charge_2 UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT auth_is_gang_authorized() THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    INSERT INTO public.gangs (
        name, 
        color, 
        zones_image, 
        created_by, 
        detective_in_charge_1, 
        detective_in_charge_2
    )
    VALUES (
        p_name, 
        p_color, 
        p_zones_image, 
        auth.uid(), 
        p_detective_in_charge_1, 
        p_detective_in_charge_2
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_gang TO authenticated;

-- 4. Create update_gang_details() to update the name, color and detectives in charge
CREATE OR REPLACE FUNCTION update_gang_details(
    p_gang_id UUID,
    p_name TEXT,
    p_color TEXT,
    p_detective_in_charge_1 UUID DEFAULT NULL,
    p_detective_in_charge_2 UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    IF NOT auth_is_gang_vip() THEN 
        RAISE EXCEPTION 'Access Denied: High Command Only'; 
    END IF;
    
    UPDATE public.gangs 
    SET name = p_name,
        color = p_color,
        detective_in_charge_1 = p_detective_in_charge_1,
        detective_in_charge_2 = p_detective_in_charge_2
    WHERE id = p_gang_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_gang_details TO authenticated;
