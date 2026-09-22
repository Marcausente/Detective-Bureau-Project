-- ==============================================================================
-- UNDERCOVER DIVISION (UD) SYSTEM SCHEMA & RPCS
-- ==============================================================================

-- 1. Table for Undercover Personas / Infiltration Identities
CREATE TABLE IF NOT EXISTS public.undercover_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    character_name TEXT NOT NULL,
    alias TEXT,
    fake_id TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'infiltrated', 'standby', 'burned', 'concluded')),
    target_gang_id UUID REFERENCES public.gangs(id) ON DELETE SET NULL,
    target_gang_name TEXT,
    backstory TEXT,
    appearance_notes TEXT,
    social_media JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    vehicles JSONB DEFAULT '[]'::jsonb,
    contacts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for Undercover Intelligence Reports on Gangs
CREATE TABLE IF NOT EXISTS public.undercover_gang_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gang_id UUID REFERENCES public.gangs(id) ON DELETE CASCADE NOT NULL,
    persona_id UUID REFERENCES public.undercover_personas(id) ON DELETE SET NULL,
    officer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK (category IN ('meeting', 'movement', 'weapons', 'drugs', 'hierarchy', 'territory', 'general')),
    threat_level TEXT DEFAULT 'medium' CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
    images JSONB DEFAULT '[]'::jsonb,
    incident_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ud_personas_officer ON public.undercover_personas(officer_id);
CREATE INDEX IF NOT EXISTS idx_ud_personas_gang ON public.undercover_personas(target_gang_id);
CREATE INDEX IF NOT EXISTS idx_ud_intel_gang ON public.undercover_gang_intel(gang_id);
CREATE INDEX IF NOT EXISTS idx_ud_intel_persona ON public.undercover_gang_intel(persona_id);

-- Enable RLS
ALTER TABLE public.undercover_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.undercover_gang_intel ENABLE ROW LEVEL SECURITY;

-- Helper security function to check if user has Undercover access
CREATE OR REPLACE FUNCTION auth_is_undercover_authorized()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_divs TEXT[];
    v_subs TEXT[];
BEGIN
    SELECT 
        TRIM(rol::text),
        divisions,
        subdivisions
    INTO v_role, v_divs, v_subs
    FROM public.users 
    WHERE id = auth.uid();

    -- Admins, High Command and Coordinators
    IF v_role ILIKE ANY(ARRAY['coordinador', 'comisionado', 'administrador', 'admin', 'superadmin']) THEN
        RETURN true;
    END IF;

    -- Undercover Division / Subdivisions
    IF v_divs IS NOT NULL AND ('Undercover' = ANY(v_divs) OR 'Undercover Division' = ANY(v_divs) OR 'UD' = ANY(v_divs)) THEN
        RETURN true;
    END IF;

    IF v_subs IS NOT NULL AND ('Undercover' = ANY(v_subs) OR 'Undercover Division' = ANY(v_subs) OR 'UD' = ANY(v_subs)) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- RLS Policies
DROP POLICY IF EXISTS "UD personas read access" ON public.undercover_personas;
CREATE POLICY "UD personas read access" ON public.undercover_personas
FOR SELECT TO authenticated
USING (auth_is_undercover_authorized());

DROP POLICY IF EXISTS "UD personas write access" ON public.undercover_personas;
CREATE POLICY "UD personas write access" ON public.undercover_personas
FOR ALL TO authenticated
USING (auth_is_undercover_authorized())
WITH CHECK (auth_is_undercover_authorized());

DROP POLICY IF EXISTS "UD intel read access" ON public.undercover_gang_intel;
CREATE POLICY "UD intel read access" ON public.undercover_gang_intel
FOR SELECT TO authenticated
USING (true); -- Authenticated gang unit detectives can also read linked intel

DROP POLICY IF EXISTS "UD intel write access" ON public.undercover_gang_intel;
CREATE POLICY "UD intel write access" ON public.undercover_gang_intel
FOR ALL TO authenticated
USING (auth_is_undercover_authorized())
WITH CHECK (auth_is_undercover_authorized());

-- ==============================================================================
-- RPCs FOR UNDERCOVER PERSONAS
-- ==============================================================================

-- 3. RPC to fetch all undercover personas
CREATE OR REPLACE FUNCTION get_undercover_personas()
RETURNS TABLE (
    id UUID,
    officer_id UUID,
    officer_name TEXT,
    officer_rank TEXT,
    officer_badge TEXT,
    officer_avatar TEXT,
    character_name TEXT,
    alias TEXT,
    fake_id TEXT,
    phone TEXT,
    status TEXT,
    target_gang_id UUID,
    target_gang_name TEXT,
    target_gang_color TEXT,
    backstory TEXT,
    appearance_notes TEXT,
    social_media JSONB,
    photos JSONB,
    vehicles JSONB,
    contacts JSONB,
    intel_count BIGINT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT auth_is_undercover_authorized() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.officer_id,
        COALESCE(u.nombre || ' ' || u.apellido, 'Oficial Desconocido') AS officer_name,
        COALESCE(u.rango::text, 'Detective') AS officer_rank,
        COALESCE(u.no_placa::text, '-') AS officer_badge,
        u.profile_image AS officer_avatar,
        p.character_name,
        p.alias,
        p.fake_id,
        p.phone,
        p.status,
        p.target_gang_id,
        COALESCE(g.name, p.target_gang_name) AS target_gang_name,
        g.color AS target_gang_color,
        p.backstory,
        p.appearance_notes,
        COALESCE(p.social_media, '[]'::jsonb),
        COALESCE(p.photos, '[]'::jsonb),
        COALESCE(p.vehicles, '[]'::jsonb),
        COALESCE(p.contacts, '[]'::jsonb),
        (SELECT COUNT(*) FROM public.undercover_gang_intel i WHERE i.persona_id = p.id) AS intel_count,
        p.created_at,
        p.updated_at
    FROM public.undercover_personas p
    LEFT JOIN public.users u ON p.officer_id = u.id
    LEFT JOIN public.gangs g ON p.target_gang_id = g.id
    ORDER BY p.created_at DESC;
END;
$$;

-- 4. RPC to save or update an undercover persona
CREATE OR REPLACE FUNCTION save_undercover_persona(
    p_id UUID DEFAULT NULL,
    p_officer_id UUID DEFAULT NULL,
    p_character_name TEXT DEFAULT '',
    p_alias TEXT DEFAULT '',
    p_fake_id TEXT DEFAULT '',
    p_phone TEXT DEFAULT '',
    p_status TEXT DEFAULT 'active',
    p_target_gang_id UUID DEFAULT NULL,
    p_target_gang_name TEXT DEFAULT '',
    p_backstory TEXT DEFAULT '',
    p_appearance_notes TEXT DEFAULT '',
    p_social_media JSONB DEFAULT '[]'::jsonb,
    p_photos JSONB DEFAULT '[]'::jsonb,
    p_vehicles JSONB DEFAULT '[]'::jsonb,
    p_contacts JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_target_name TEXT;
BEGIN
    IF NOT auth_is_undercover_authorized() THEN
        RAISE EXCEPTION 'Access Denied: No tienes permisos para gestionar la división Undercover';
    END IF;

    IF p_target_gang_id IS NOT NULL THEN
        SELECT name INTO v_target_name FROM public.gangs WHERE id = p_target_gang_id;
    END IF;
    IF v_target_name IS NULL OR v_target_name = '' THEN
        v_target_name := p_target_gang_name;
    END IF;

    IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.undercover_personas WHERE id = p_id) THEN
        UPDATE public.undercover_personas
        SET
            officer_id = COALESCE(p_officer_id, officer_id),
            character_name = p_character_name,
            alias = p_alias,
            fake_id = p_fake_id,
            phone = p_phone,
            status = p_status,
            target_gang_id = p_target_gang_id,
            target_gang_name = v_target_name,
            backstory = p_backstory,
            appearance_notes = p_appearance_notes,
            social_media = p_social_media,
            photos = p_photos,
            vehicles = p_vehicles,
            contacts = p_contacts,
            updated_at = now()
        WHERE id = p_id;
        v_id := p_id;
    ELSE
        INSERT INTO public.undercover_personas (
            officer_id,
            character_name,
            alias,
            fake_id,
            phone,
            status,
            target_gang_id,
            target_gang_name,
            backstory,
            appearance_notes,
            social_media,
            photos,
            vehicles,
            contacts
        ) VALUES (
            p_officer_id,
            p_character_name,
            p_alias,
            p_fake_id,
            p_phone,
            p_status,
            p_target_gang_id,
            v_target_name,
            p_backstory,
            p_appearance_notes,
            p_social_media,
            p_photos,
            p_vehicles,
            p_contacts
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$;

-- 5. RPC to delete an undercover persona
CREATE OR REPLACE FUNCTION delete_undercover_persona(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT auth_is_undercover_authorized() THEN
        RAISE EXCEPTION 'Access Denied: No tienes permisos para gestionar la división Undercover';
    END IF;

    DELETE FROM public.undercover_personas WHERE id = p_id;
    RETURN true;
END;
$$;

-- ==============================================================================
-- RPCs FOR UNDERCOVER GANG INTELLIGENCE
-- ==============================================================================

-- 6. RPC to get undercover intelligence reports
CREATE OR REPLACE FUNCTION get_undercover_gang_intel(p_gang_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    gang_id UUID,
    gang_name TEXT,
    gang_color TEXT,
    persona_id UUID,
    persona_name TEXT,
    persona_alias TEXT,
    persona_photo TEXT,
    officer_id UUID,
    officer_name TEXT,
    officer_rank TEXT,
    officer_avatar TEXT,
    title TEXT,
    content TEXT,
    category TEXT,
    threat_level TEXT,
    images JSONB,
    incident_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    can_edit BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_is_ud BOOLEAN;
BEGIN
    v_uid := auth.uid();
    v_is_ud := auth_is_undercover_authorized();

    RETURN QUERY
    SELECT
        i.id,
        i.gang_id,
        g.name AS gang_name,
        g.color AS gang_color,
        i.persona_id,
        COALESCE(p.character_name, 'Agente Encubierto') AS persona_name,
        p.alias AS persona_alias,
        (SELECT p.photos->>0) AS persona_photo,
        i.officer_id,
        COALESCE(u.nombre || ' ' || u.apellido, 'Agente') AS officer_name,
        COALESCE(u.rango::text, 'Detective') AS officer_rank,
        u.profile_image AS officer_avatar,
        i.title,
        i.content,
        i.category,
        i.threat_level,
        COALESCE(i.images, '[]'::jsonb),
        i.incident_date,
        i.created_at,
        (i.officer_id = v_uid OR v_is_ud) AS can_edit
    FROM public.undercover_gang_intel i
    JOIN public.gangs g ON i.gang_id = g.id
    LEFT JOIN public.undercover_personas p ON i.persona_id = p.id
    LEFT JOIN public.users u ON i.officer_id = u.id
    WHERE (p_gang_id IS NULL OR i.gang_id = p_gang_id)
    ORDER BY i.incident_date DESC, i.created_at DESC;
END;
$$;

-- 7. RPC to save or update undercover gang intelligence
CREATE OR REPLACE FUNCTION save_undercover_gang_intel(
    p_id UUID DEFAULT NULL,
    p_gang_id UUID DEFAULT NULL,
    p_persona_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT '',
    p_content TEXT DEFAULT '',
    p_category TEXT DEFAULT 'general',
    p_threat_level TEXT DEFAULT 'medium',
    p_images JSONB DEFAULT '[]'::jsonb,
    p_incident_date TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_uid UUID;
    v_officer_id UUID;
BEGIN
    v_uid := auth.uid();
    
    IF NOT auth_is_undercover_authorized() THEN
        RAISE EXCEPTION 'Access Denied: No tienes permisos para registrar inteligencia Undercover';
    END IF;

    -- If persona is selected, inherit officer_id from persona
    IF p_persona_id IS NOT NULL THEN
        SELECT officer_id INTO v_officer_id FROM public.undercover_personas WHERE id = p_persona_id;
    END IF;
    IF v_officer_id IS NULL THEN
        v_officer_id := v_uid;
    END IF;

    IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.undercover_gang_intel WHERE id = p_id) THEN
        UPDATE public.undercover_gang_intel
        SET
            gang_id = p_gang_id,
            persona_id = p_persona_id,
            officer_id = v_officer_id,
            title = p_title,
            content = p_content,
            category = p_category,
            threat_level = p_threat_level,
            images = p_images,
            incident_date = COALESCE(p_incident_date, now())
        WHERE id = p_id;
        v_id := p_id;
    ELSE
        INSERT INTO public.undercover_gang_intel (
            gang_id,
            persona_id,
            officer_id,
            title,
            content,
            category,
            threat_level,
            images,
            incident_date
        ) VALUES (
            p_gang_id,
            p_persona_id,
            v_officer_id,
            p_title,
            p_content,
            p_category,
            p_threat_level,
            p_images,
            COALESCE(p_incident_date, now())
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$;

-- 8. RPC to delete undercover gang intelligence
CREATE OR REPLACE FUNCTION delete_undercover_gang_intel(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT auth_is_undercover_authorized() THEN
        RAISE EXCEPTION 'Access Denied: No tienes permisos para eliminar inteligencia Undercover';
    END IF;

    DELETE FROM public.undercover_gang_intel WHERE id = p_id;
    RETURN true;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION auth_is_undercover_authorized() TO authenticated;
GRANT EXECUTE ON FUNCTION get_undercover_personas() TO authenticated;
GRANT EXECUTE ON FUNCTION save_undercover_persona(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_undercover_persona(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_undercover_gang_intel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION save_undercover_gang_intel(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_undercover_gang_intel(UUID) TO authenticated;
