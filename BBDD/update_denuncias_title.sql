-- Alter table to add columns
ALTER TABLE public.denuncias ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT 'Sin título';

-- Drop existing functions to avoid parameter list mismatch errors
DROP FUNCTION IF EXISTS create_denuncia(UUID, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_denuncias();
DROP FUNCTION IF EXISTS update_denuncia(UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Recreate create_denuncia
CREATE OR REPLACE FUNCTION create_denuncia(
    p_case_id UUID,
    p_complainants JSONB,
    p_accused JSONB,
    p_motivo TEXT,
    p_acontecimientos TEXT,
    p_solicitud TEXT,
    p_notas TEXT,
    p_image_url TEXT,
    p_titulo TEXT
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.denuncias (
        case_id, complainants, accused, motivo, acontecimientos, solicitud, notas, image_url, author_id, titulo
    )
    VALUES (
        p_case_id, p_complainants, p_accused, p_motivo, p_acontecimientos, p_solicitud, p_notas, p_image_url, auth.uid(), p_titulo
    )
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate get_denuncias
CREATE OR REPLACE FUNCTION get_denuncias()
RETURNS TABLE (
    record_id UUID,
    case_id UUID,
    case_title TEXT,
    status TEXT,
    complainants JSONB,
    accused JSONB,
    motivo TEXT,
    acontecimientos TEXT,
    solicitud TEXT,
    notas TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    is_author BOOLEAN,
    can_delete BOOLEAN,
    titulo TEXT
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(u_auth.rol::text) INTO v_user_role FROM public.users u_auth WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        d.id AS record_id,
        d.case_id,
        c.title AS case_title,
        d.status,
        d.complainants,
        d.accused,
        d.motivo,
        d.acontecimientos,
        d.solicitud,
        d.notas,
        d.image_url,
        d.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        u.profile_image AS author_avatar,
        (d.author_id = v_uid) AS is_author,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR d.author_id = v_uid) AS can_delete,
        d.titulo
    FROM public.denuncias d
    LEFT JOIN public.cases c ON d.case_id = c.id
    LEFT JOIN public.users u ON d.author_id = u.id
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate update_denuncia
CREATE OR REPLACE FUNCTION update_denuncia(
    p_id UUID,
    p_case_id UUID,
    p_complainants JSONB,
    p_accused JSONB,
    p_motivo TEXT,
    p_acontecimientos TEXT,
    p_solicitud TEXT,
    p_notas TEXT,
    p_image_url TEXT,
    p_titulo TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.denuncias
    SET
        case_id = p_case_id,
        complainants = p_complainants,
        accused = p_accused,
        motivo = p_motivo,
        acontecimientos = p_acontecimientos,
        solicitud = p_solicitud,
        notas = p_notas,
        image_url = p_image_url,
        titulo = p_titulo
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set Permissions
GRANT EXECUTE ON FUNCTION create_denuncia TO authenticated;
GRANT EXECUTE ON FUNCTION get_denuncias TO authenticated;
GRANT EXECUTE ON FUNCTION update_denuncia TO authenticated;
