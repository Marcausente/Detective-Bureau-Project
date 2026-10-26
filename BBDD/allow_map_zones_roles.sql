-- =========================================================================
-- PERMISOS PARA GESTIÓN DE ZONAS EN EL MAPA (DETECTIVE, COMISIONADO, COORDINADOR, ADMINISTRADOR)
-- =========================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- Permite que los roles Detective, Comisionado, Coordinador y Administrador
-- puedan crear, modificar y eliminar zonas conflictivas y tácticas en el mapa.

-- 1. Actualizar la función auth_is_gang_authorized() con soporte insensible a mayúsculas
CREATE OR REPLACE FUNCTION public.auth_is_gang_authorized() 
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
    
    RETURN LOWER(COALESCE(v_role, '')) IN (
        'detective', 
        'comisionado', 
        'coordinador', 
        'coordinacion', 
        'coordinación', 
        'administrador', 
        'admin', 
        'superadmin'
    ) OR COALESCE(v_has_gang_unit, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.auth_is_gang_authorized() TO authenticated;

-- 2. Asegurar permisos RLS sobre la tabla map_zones
ALTER TABLE public.map_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can view zones" ON public.map_zones;
CREATE POLICY "Auth can view zones" ON public.map_zones
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth can insert zones" ON public.map_zones;
CREATE POLICY "Auth can insert zones" ON public.map_zones
    FOR INSERT TO authenticated WITH CHECK (public.auth_is_gang_authorized());

DROP POLICY IF EXISTS "Auth can update zones" ON public.map_zones;
CREATE POLICY "Auth can update zones" ON public.map_zones
    FOR UPDATE TO authenticated USING (public.auth_is_gang_authorized());

DROP POLICY IF EXISTS "Auth can delete zones" ON public.map_zones;
CREATE POLICY "Auth can delete zones" ON public.map_zones
    FOR DELETE TO authenticated USING (public.auth_is_gang_authorized());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_zones TO authenticated;
GRANT ALL ON TABLE public.map_zones TO postgres, service_role;

-- 3. Actualizar función create_map_zone con verificación de roles
CREATE OR REPLACE FUNCTION public.create_map_zone(
    p_name TEXT,
    p_description TEXT,
    p_coordinates JSONB,
    p_type TEXT DEFAULT 'polygon',
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
    IF NOT public.auth_is_gang_authorized() THEN 
        RAISE EXCEPTION 'Access Denied: Se requiere rol de Detective, Comisionado, Coordinador o Administrador.'; 
    END IF;

    INSERT INTO public.map_zones (
        name, 
        description, 
        coordinates, 
        type, 
        gang_id, 
        case_id, 
        incident_id, 
        color, 
        is_gang_zone, 
        emoji, 
        is_surveillance, 
        created_by
    )
    VALUES (
        p_name, 
        p_description, 
        p_coordinates, 
        COALESCE(p_type, 'polygon'), 
        p_gang_id, 
        p_case_id, 
        p_incident_id, 
        COALESCE(p_color, '#ef4444'), 
        COALESCE(p_is_gang_zone, false), 
        p_emoji, 
        COALESCE(p_is_surveillance, false), 
        auth.uid()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar función update_map_zone con verificación de roles
CREATE OR REPLACE FUNCTION public.update_map_zone(
    p_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_gang_id UUID DEFAULT NULL,
    p_case_id UUID DEFAULT NULL,
    p_incident_id UUID DEFAULT NULL,
    p_color TEXT DEFAULT '#ef4444',
    p_is_gang_zone BOOLEAN DEFAULT FALSE,
    p_emoji TEXT DEFAULT NULL,
    p_is_surveillance BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
    IF NOT public.auth_is_gang_authorized() THEN 
        RAISE EXCEPTION 'Access Denied: Se requiere rol de Detective, Comisionado, Coordinador o Administrador.'; 
    END IF;

    UPDATE public.map_zones
    SET 
        name = p_name,
        description = p_description,
        gang_id = p_gang_id,
        case_id = p_case_id,
        incident_id = p_incident_id,
        color = COALESCE(p_color, '#ef4444'),
        is_gang_zone = COALESCE(p_is_gang_zone, false),
        emoji = p_emoji,
        is_surveillance = COALESCE(p_is_surveillance, false)
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Actualizar función delete_map_zone con verificación de roles
CREATE OR REPLACE FUNCTION public.delete_map_zone(p_id UUID) 
RETURNS VOID AS $$
BEGIN
    IF NOT public.auth_is_gang_authorized() THEN 
        RAISE EXCEPTION 'Access Denied: Se requiere rol de Detective, Comisionado, Coordinador o Administrador.'; 
    END IF;

    DELETE FROM public.map_zones WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_map_zone TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_map_zone TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_map_zone TO authenticated;
