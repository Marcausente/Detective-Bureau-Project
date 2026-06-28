-- Add is_surveillance column to map_zones
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='map_zones' AND column_name='is_surveillance') THEN
        ALTER TABLE public.map_zones ADD COLUMN is_surveillance BOOLEAN DEFAULT false;
    END IF;
END
$$;

-- Create helper function to check if user belongs to Gang Unit
CREATE OR REPLACE FUNCTION public.auth_is_gang_unit_member() RETURNS BOOLEAN AS $$
DECLARE
    v_has_gu BOOLEAN;
BEGIN
    SELECT 'Gang Unit' = ANY(subdivisions) INTO v_has_gu
    FROM public.users
    WHERE id = auth.uid();
    RETURN COALESCE(v_has_gu, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.auth_is_gang_unit_member TO authenticated;

-- Recreate policies on map_zones
DROP POLICY IF EXISTS "Auth can view zones" ON public.map_zones;
CREATE POLICY "Auth can view zones" ON public.map_zones
    FOR SELECT TO authenticated 
    USING (
        is_surveillance = false 
        OR auth_is_gang_unit_member()
    );

-- Drop old functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.create_map_zone(text, text, jsonb, text, uuid, uuid, uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.update_map_zone(uuid, text, text, uuid, uuid, uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.get_map_zones();
DROP FUNCTION IF EXISTS public.get_public_gang_zones();

-- Re-create create_map_zone (add p_is_surveillance)
CREATE OR REPLACE FUNCTION public.create_map_zone(
    p_name TEXT,
    p_description TEXT,
    p_coordinates JSONB,
    p_type TEXT,
    p_gang_id UUID DEFAULT NULL,
    p_case_id UUID DEFAULT NULL,
    p_incident_id UUID DEFAULT NULL,
    p_color TEXT DEFAULT '#ef4444',
    p_is_gang_zone BOOLEAN DEFAULT FALSE,
    p_emoji TEXT DEFAULT NULL,
    p_is_surveillance BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    
    -- Check if trying to create a surveillance zone and has no GU division
    IF p_is_surveillance AND NOT auth_is_gang_unit_member() THEN
        RAISE EXCEPTION 'Access Denied: Gang Unit division required to create surveillance zones';
    END IF;

    INSERT INTO public.map_zones (name, description, coordinates, type, gang_id, case_id, incident_id, color, is_gang_zone, emoji, is_surveillance, created_by)
    VALUES (p_name, p_description, p_coordinates, p_type, p_gang_id, p_case_id, p_incident_id, p_color, p_is_gang_zone, p_emoji, p_is_surveillance, auth.uid())
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create update_map_zone (add p_is_surveillance)
CREATE OR REPLACE FUNCTION public.update_map_zone(
    p_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_gang_id UUID,
    p_case_id UUID,
    p_incident_id UUID,
    p_color TEXT,
    p_is_gang_zone BOOLEAN,
    p_emoji TEXT DEFAULT NULL,
    p_is_surveillance BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;

    -- Check if it's already a surveillance zone or is being updated to one
    IF (p_is_surveillance OR EXISTS (SELECT 1 FROM public.map_zones WHERE id = p_id AND is_surveillance = true)) 
       AND NOT auth_is_gang_unit_member() THEN
        RAISE EXCEPTION 'Access Denied: Gang Unit division required for surveillance zones';
    END IF;

    UPDATE public.map_zones
    SET 
        name = p_name,
        description = p_description,
        gang_id = p_gang_id,
        case_id = p_case_id,
        incident_id = p_incident_id,
        color = p_color,
        is_gang_zone = p_is_gang_zone,
        emoji = p_emoji,
        is_surveillance = p_is_surveillance
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create get_map_zones (include is_surveillance and filtering)
CREATE OR REPLACE FUNCTION public.get_map_zones()
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    coordinates JSONB,
    type TEXT,
    color TEXT,
    gang_id UUID,
    gang_name TEXT,
    case_id UUID,
    case_title TEXT,
    incident_id UUID,
    incident_title TEXT,
    is_gang_zone BOOLEAN,
    emoji TEXT,
    is_surveillance BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mz.id,
        mz.name,
        mz.description,
        mz.coordinates,
        mz.type,
        mz.color,
        mz.gang_id,
        g.name AS gang_name,
        mz.case_id,
        c.title AS case_title,
        mz.incident_id,
        i.title AS incident_title,
        mz.is_gang_zone,
        mz.emoji,
        mz.is_surveillance,
        mz.created_at
    FROM public.map_zones mz
    LEFT JOIN public.gangs g ON mz.gang_id = g.id
    LEFT JOIN public.cases c ON mz.case_id = c.id
    LEFT JOIN public.incidents i ON mz.incident_id = i.id
    WHERE mz.is_surveillance = false 
       OR auth_is_gang_unit_member();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create get_public_gang_zones
CREATE OR REPLACE FUNCTION public.get_public_gang_zones()
RETURNS TABLE (
    name TEXT,
    description TEXT,
    coordinates JSONB,
    type TEXT,
    color TEXT,
    emoji TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mz.name,
        mz.description,
        mz.coordinates,
        mz.type,
        mz.color,
        mz.emoji
    FROM public.map_zones mz
    WHERE mz.is_gang_zone = true AND mz.is_surveillance = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_map_zone TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_map_zone TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_zones TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_gang_zones TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_gang_zones TO authenticated;
