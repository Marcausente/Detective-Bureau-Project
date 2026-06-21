-- =======================================================
-- BALLISTICS SYSTEM (SISTEMA DE BALÍSTICA)
-- =======================================================

-- 1. Create Seized Bullets Table (Tabla de Casquillos Incautados)
CREATE TABLE IF NOT EXISTS public.ballistics_bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidente_relacionado TEXT NOT NULL,
    calibre TEXT NOT NULL,
    numero_serie TEXT NOT NULL,
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Seized Weapons Table (Tabla de Armas Incautadas)
CREATE TABLE IF NOT EXISTS public.ballistics_weapons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    propietario TEXT NOT NULL,
    incidente_relacionado TEXT NOT NULL,
    modelo TEXT NOT NULL,
    numero_serie TEXT NOT NULL,
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.ballistics_bullets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballistics_weapons ENABLE ROW LEVEL SECURITY;

-- 4. Define RLS Policies
DROP POLICY IF EXISTS "Read bullets allowed for auth" ON public.ballistics_bullets;
CREATE POLICY "Read bullets allowed for auth" 
  ON public.ballistics_bullets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert bullets allowed for auth" ON public.ballistics_bullets;
CREATE POLICY "Insert bullets allowed for auth" 
  ON public.ballistics_bullets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Delete bullets allowed for auth" ON public.ballistics_bullets;
CREATE POLICY "Delete bullets allowed for auth" 
  ON public.ballistics_bullets FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Read weapons allowed for auth" ON public.ballistics_weapons;
CREATE POLICY "Read weapons allowed for auth" 
  ON public.ballistics_weapons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert weapons allowed for auth" ON public.ballistics_weapons;
CREATE POLICY "Insert weapons allowed for auth" 
  ON public.ballistics_weapons FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Delete weapons allowed for auth" ON public.ballistics_weapons;
CREATE POLICY "Delete weapons allowed for auth" 
  ON public.ballistics_weapons FOR DELETE TO authenticated USING (true);


-- 5. RPC Functions for Bullets

-- Create Seized Bullet
CREATE OR REPLACE FUNCTION create_ballistics_bullet(
    p_incidente TEXT,
    p_calibre TEXT,
    p_num_serie TEXT
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.ballistics_bullets (incidente_relacionado, calibre, numero_serie, author_id)
    VALUES (p_incidente, p_calibre, p_num_serie, auth.uid())
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Seized Bullets
CREATE OR REPLACE FUNCTION get_ballistics_bullets()
RETURNS TABLE (
    id UUID,
    incidente_relacionado TEXT,
    calibre TEXT,
    numero_serie TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
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
        b.id,
        b.incidente_relacionado,
        b.calibre,
        b.numero_serie,
        b.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR b.author_id = v_uid) AS can_delete
    FROM public.ballistics_bullets b
    LEFT JOIN public.users u ON b.author_id = u.id
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete Seized Bullet
CREATE OR REPLACE FUNCTION delete_ballistics_bullet(p_id UUID)
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_author_id UUID;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;
    SELECT author_id INTO v_author_id FROM public.ballistics_bullets WHERE id = p_id;

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR (v_author_id = v_uid) THEN
        DELETE FROM public.ballistics_bullets WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this bullet record.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC Functions for Weapons

-- Create Seized Weapon
CREATE OR REPLACE FUNCTION create_ballistics_weapon(
    p_propietario TEXT,
    p_incidente TEXT,
    p_modelo TEXT,
    p_num_serie TEXT
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.ballistics_weapons (propietario, incidente_relacionado, modelo, numero_serie, author_id)
    VALUES (p_propietario, p_incidente, p_modelo, p_num_serie, auth.uid())
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Seized Weapons
CREATE OR REPLACE FUNCTION get_ballistics_weapons()
RETURNS TABLE (
    id UUID,
    propietario TEXT,
    incidente_relacionado TEXT,
    modelo TEXT,
    numero_serie TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    author_name TEXT,
    author_rank TEXT,
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
        w.id,
        w.propietario,
        w.incidente_relacionado,
        w.modelo,
        w.numero_serie,
        w.created_at,
        (u.nombre || ' ' || u.apellido) AS author_name,
        u.rango::text AS author_rank,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado') OR w.author_id = v_uid) AS can_delete
    FROM public.ballistics_weapons w
    LEFT JOIN public.users u ON w.author_id = u.id
    ORDER BY w.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete Seized Weapon
CREATE OR REPLACE FUNCTION delete_ballistics_weapon(p_id UUID)
RETURNS VOID AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
    v_author_id UUID;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;
    SELECT author_id INTO v_author_id FROM public.ballistics_weapons WHERE id = p_id;

    IF (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado')) OR (v_author_id = v_uid) THEN
        DELETE FROM public.ballistics_weapons WHERE id = p_id;
    ELSE
         RAISE EXCEPTION 'Access Denied: You cannot delete this weapon record.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Grant Permissions (Otorgar Permisos)
GRANT EXECUTE ON FUNCTION create_ballistics_bullet TO authenticated;
GRANT EXECUTE ON FUNCTION get_ballistics_bullets TO authenticated;
GRANT EXECUTE ON FUNCTION delete_ballistics_bullet TO authenticated;
GRANT EXECUTE ON FUNCTION create_ballistics_weapon TO authenticated;
GRANT EXECUTE ON FUNCTION get_ballistics_weapons TO authenticated;
GRANT EXECUTE ON FUNCTION delete_ballistics_weapon TO authenticated;
