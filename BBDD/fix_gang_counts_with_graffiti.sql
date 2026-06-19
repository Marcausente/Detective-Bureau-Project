-- HOTFIX: Fix Incident and Outing Counts for Gangs List
-- Redefines get_gangs_data() to properly query the junction tables (incident_gangs, outing_gangs)
-- while retaining the new 'graffiti' collection support.

DROP FUNCTION IF EXISTS get_gangs_data();

CREATE OR REPLACE FUNCTION get_gangs_data()
RETURNS TABLE (
    gang_id UUID,
    name TEXT,
    color TEXT,
    zones_image TEXT,
    is_archived BOOLEAN,
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
