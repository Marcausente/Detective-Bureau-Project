-- =======================================================
-- MIGRATION: ADD EDITING SUPPORT FOR BALLISTICS (BALÍSTICA)
-- Permite editar casquillos y armas incautadas
-- =======================================================

-- 1. Ensure RLS UPDATE policies exist
DROP POLICY IF EXISTS "Update bullets allowed for auth" ON public.ballistics_bullets;
CREATE POLICY "Update bullets allowed for auth" 
  ON public.ballistics_bullets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Update weapons allowed for auth" ON public.ballistics_weapons;
CREATE POLICY "Update weapons allowed for auth" 
  ON public.ballistics_weapons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. RPC Function: Update Seized Bullet
CREATE OR REPLACE FUNCTION update_ballistics_bullet(
    p_id UUID,
    p_incidente TEXT,
    p_calibre TEXT DEFAULT 'N/A',
    p_num_serie TEXT DEFAULT '',
    p_modelo_arma TEXT DEFAULT 'N/A'
)
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
        UPDATE public.ballistics_bullets
        SET 
            incidente_relacionado = p_incidente,
            calibre = COALESCE(NULLIF(TRIM(p_calibre), ''), 'N/A'),
            numero_serie = p_num_serie,
            modelo_arma = COALESCE(NULLIF(TRIM(p_modelo_arma), ''), 'N/A')
        WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You cannot edit this bullet record.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC Function: Update Seized Weapon
CREATE OR REPLACE FUNCTION update_ballistics_weapon(
    p_id UUID,
    p_propietario TEXT,
    p_incidente TEXT,
    p_modelo TEXT,
    p_num_serie TEXT
)
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
        UPDATE public.ballistics_weapons
        SET 
            propietario = p_propietario,
            incidente_relacionado = p_incidente,
            modelo = p_modelo,
            numero_serie = p_num_serie
        WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You cannot edit this weapon record.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant Permissions
GRANT EXECUTE ON FUNCTION update_ballistics_bullet TO authenticated;
GRANT EXECUTE ON FUNCTION update_ballistics_weapon TO authenticated;
