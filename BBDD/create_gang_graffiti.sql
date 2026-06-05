-- MIGRATION SCRIPT: CREATE GANG GRAFFITI SYSTEM
-- Runs in Supabase SQL Editor

-- 1. Create the gang_graffitis table
CREATE TABLE IF NOT EXISTS public.gang_graffitis (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    gang_id UUID REFERENCES public.gangs(id) ON DELETE CASCADE,
    graffiti_image TEXT NOT NULL, -- Base64 encoded JPEG image
    gps_image TEXT NOT NULL, -- Base64 encoded JPEG image of the map/GPS location
    notes TEXT, -- Optional notes/description
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.gang_graffitis ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows safe re-running)
DROP POLICY IF EXISTS "Authorized can view graffitis" ON public.gang_graffitis;
DROP POLICY IF EXISTS "Authorized can insert graffitis" ON public.gang_graffitis;
DROP POLICY IF EXISTS "Authorized can update graffitis" ON public.gang_graffitis;
DROP POLICY IF EXISTS "Authorized can delete graffitis" ON public.gang_graffitis;

-- Create RLS Policies
CREATE POLICY "Authorized can view graffitis" ON public.gang_graffitis FOR SELECT USING (auth_is_gang_authorized());
CREATE POLICY "Authorized can insert graffitis" ON public.gang_graffitis FOR INSERT WITH CHECK (auth_is_gang_authorized());
CREATE POLICY "Authorized can update graffitis" ON public.gang_graffitis FOR UPDATE USING (auth_is_gang_authorized());
CREATE POLICY "Authorized can delete graffitis" ON public.gang_graffitis FOR DELETE USING (auth_is_gang_authorized());

-- 3. Define RPC helper functions to Add and Update gang graffiti
CREATE OR REPLACE FUNCTION add_gang_graffiti(
    p_gang_id UUID,
    p_graffiti_image TEXT,
    p_gps_image TEXT,
    p_notes TEXT
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT auth_is_gang_authorized() THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    INSERT INTO public.gang_graffitis (gang_id, graffiti_image, gps_image, notes)
    VALUES (p_gang_id, p_graffiti_image, p_gps_image, p_notes)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_gang_graffiti(
    p_graffiti_id UUID,
    p_graffiti_image TEXT,
    p_gps_image TEXT,
    p_notes TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT auth_is_gang_authorized() THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF;
    
    UPDATE public.gang_graffitis
    SET graffiti_image = p_graffiti_image,
        gps_image = p_gps_image,
        notes = p_notes
    WHERE id = p_graffiti_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the delete_gang_item RPC to handle graffiti deletion
CREATE OR REPLACE FUNCTION delete_gang_item(p_table TEXT, p_id UUID) RETURNS VOID AS $$
BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    IF p_table = 'vehicle' THEN DELETE FROM public.gang_vehicles WHERE id = p_id;
    ELSIF p_table = 'home' THEN DELETE FROM public.gang_homes WHERE id = p_id;
    ELSIF p_table = 'member' THEN DELETE FROM public.gang_members WHERE id = p_id;
    ELSIF p_table = 'info' THEN DELETE FROM public.gang_info WHERE id = p_id;
    ELSIF p_table = 'graffiti' THEN DELETE FROM public.gang_graffitis WHERE id = p_id;
    END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Redefine get_gangs_data() to load graffiti list
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
        -- Counts
        (SELECT COUNT(*) FROM public.incidents inc WHERE inc.gang_id = g.id),
        (SELECT COUNT(*) FROM public.outings out WHERE out.gang_id = g.id),
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

-- Grant permissions for authenticated users to run these functions
GRANT EXECUTE ON FUNCTION add_gang_graffiti TO authenticated;
GRANT EXECUTE ON FUNCTION update_gang_graffiti TO authenticated;
GRANT EXECUTE ON FUNCTION get_gangs_data TO authenticated;
