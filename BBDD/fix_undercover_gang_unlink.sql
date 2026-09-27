-- ==============================================================================
-- FIX: Permitir desvincular grupos/bandas (incluidas bandas archivadas) en Undercover
-- ==============================================================================

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
        CASE WHEN p.target_gang_id IS NOT NULL THEN COALESCE(g.name, p.target_gang_name) ELSE NULL END AS target_gang_name,
        CASE WHEN p.target_gang_id IS NOT NULL THEN g.color ELSE NULL END AS target_gang_color,
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

CREATE OR REPLACE FUNCTION save_undercover_persona(
    p_id UUID DEFAULT NULL,
    p_officer_id UUID DEFAULT NULL,
    p_character_name TEXT DEFAULT '',
    p_alias TEXT DEFAULT '',
    p_fake_id TEXT DEFAULT '',
    p_phone TEXT DEFAULT '',
    p_status TEXT DEFAULT 'active',
    p_target_gang_id UUID DEFAULT NULL,
    p_target_gang_name TEXT DEFAULT NULL,
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
    v_target_name TEXT := NULL;
BEGIN
    IF NOT auth_is_undercover_authorized() THEN
        RAISE EXCEPTION 'Access Denied: No tienes permisos para gestionar la división Undercover';
    END IF;

    IF p_target_gang_id IS NOT NULL THEN
        SELECT name INTO v_target_name FROM public.gangs WHERE id = p_target_gang_id;
        IF v_target_name IS NULL OR v_target_name = '' THEN
            v_target_name := p_target_gang_name;
        END IF;
    ELSE
        v_target_name := NULL;
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

GRANT EXECUTE ON FUNCTION get_undercover_personas() TO authenticated;
GRANT EXECUTE ON FUNCTION save_undercover_persona(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB) TO authenticated;
