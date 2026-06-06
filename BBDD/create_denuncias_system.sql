-- DENUNCIAS (COMPLAINTS) SYSTEM
-- 1. Create Denuncias Table
CREATE TABLE IF NOT EXISTS public.denuncias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
    complainants JSONB DEFAULT '[]'::jsonb,
    accused JSONB DEFAULT '[]'::jsonb,
    motivo TEXT NOT NULL,
    acontecimientos TEXT NOT NULL,
    solicitud TEXT,
    notas TEXT,
    image_url TEXT, -- Base64 encoded string or image link
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Denuncias
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

-- 2. Define RLS Policies
DROP POLICY IF EXISTS "Read complaints allowed for auth" ON public.denuncias;
CREATE POLICY "Read complaints allowed for auth" 
  ON public.denuncias FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert complaints allowed for auth" ON public.denuncias;
CREATE POLICY "Insert complaints allowed for auth" 
  ON public.denuncias FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Update complaints allowed for auth" ON public.denuncias;
CREATE POLICY "Update complaints allowed for auth" 
  ON public.denuncias FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Delete complaints allowed for auth" ON public.denuncias;
CREATE POLICY "Delete complaints allowed for auth" 
  ON public.denuncias FOR DELETE TO authenticated USING (true);

-- 3. RPC Functions

-- Create Denuncia RPC
CREATE OR REPLACE FUNCTION create_denuncia(
    p_case_id UUID,
    p_complainants JSONB,
    p_accused JSONB,
    p_motivo TEXT,
    p_acontecimientos TEXT,
    p_solicitud TEXT,
    p_notas TEXT,
    p_image_url TEXT
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.denuncias (
        case_id, complainants, accused, motivo, acontecimientos, solicitud, notas, image_url, author_id
    )
    VALUES (
        p_case_id, p_complainants, p_accused, p_motivo, p_acontecimientos, p_solicitud, p_notas, p_image_url, auth.uid()
    )
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Denuncias RPC
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
    can_delete BOOLEAN
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
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR d.author_id = v_uid) AS can_delete
    FROM public.denuncias d
    LEFT JOIN public.cases c ON d.case_id = c.id
    LEFT JOIN public.users u ON d.author_id = u.id
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Denuncia RPC
CREATE OR REPLACE FUNCTION update_denuncia(
    p_id UUID,
    p_case_id UUID,
    p_complainants JSONB,
    p_accused JSONB,
    p_motivo TEXT,
    p_acontecimientos TEXT,
    p_solicitud TEXT,
    p_notas TEXT,
    p_image_url TEXT
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
        image_url = p_image_url
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set Denuncia Status RPC
CREATE OR REPLACE FUNCTION set_denuncia_status(p_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.denuncias
    SET status = p_status
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete Denuncia RPC
CREATE OR REPLACE FUNCTION delete_denuncia(p_id UUID)
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_author_id UUID;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;
    SELECT author_id INTO v_author_id FROM public.denuncias WHERE id = p_id;

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR (v_author_id = v_uid) THEN
        DELETE FROM public.denuncias WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this complaint.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Set Permissions
GRANT EXECUTE ON FUNCTION create_denuncia TO authenticated;
GRANT EXECUTE ON FUNCTION get_denuncias TO authenticated;
GRANT EXECUTE ON FUNCTION update_denuncia TO authenticated;
GRANT EXECUTE ON FUNCTION set_denuncia_status TO authenticated;
GRANT EXECUTE ON FUNCTION delete_denuncia TO authenticated;
