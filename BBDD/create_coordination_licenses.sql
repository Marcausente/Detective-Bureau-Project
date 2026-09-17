-- create_coordination_licenses.sql
-- Migration to create coordination_licenses table, user licenses column, and RPCs

-- 1. Table: coordination_licenses
CREATE TABLE IF NOT EXISTS public.coordination_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    code TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#10b981',
    icon TEXT DEFAULT '🪪',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default department licenses if not already existing
INSERT INTO public.coordination_licenses (name, code, description, color, icon, is_default)
VALUES 
    ('Licencia de Foxtrot', 'FX', 'Habilitación para conducción y maniobras de persecución avanzada en unidad Foxtrot.', '#10b981', '🚗', true),
    ('Licencia de Mike', 'MK', 'Habilitación para patrullaje, persecución e intervención en unidad motocicleta (Mike).', '#f59e0b', '🏍️', true),
    ('Licencia de Aire / Piloto', 'AIR', 'Habilitación de vuelo y operaciones tácticas en unidades aéreas del Departamento.', '#06b6d4', '🚁', false),
    ('Licencia K-9 (Canina)', 'K9', 'Habilitación y acreditación para el adiestramiento y despliegue de unidad canina K-9.', '#a855f7', '🐕', false),
    ('Licencia Táctica Especial', 'TAC', 'Habilitación para porte de armamento especial y tácticas de asalto.', '#ef4444', '🎯', false)
ON CONFLICT (name) DO UPDATE 
SET code = EXCLUDED.code, 
    description = EXCLUDED.description, 
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    is_default = EXCLUDED.is_default;

-- Enable RLS on coordination_licenses
ALTER TABLE public.coordination_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read licenses" ON public.coordination_licenses;
DROP POLICY IF EXISTS "Allow authenticated manage licenses" ON public.coordination_licenses;

CREATE POLICY "Allow authenticated read licenses"
ON public.coordination_licenses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated manage licenses"
ON public.coordination_licenses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Add licenses column to public.users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='licenses') THEN
        ALTER TABLE public.users ADD COLUMN licenses TEXT[] DEFAULT '{}';
    END IF;
END
$$;

-- 3. Create RPC: update_user_licenses
CREATE OR REPLACE FUNCTION public.update_user_licenses(
    p_target_user_id UUID,
    p_licenses TEXT[]
)
RETURNS VOID AS $$
DECLARE
    v_viewer_role app_role;
BEGIN
    -- Get caller's role
    SELECT rol INTO v_viewer_role
    FROM public.users
    WHERE id = auth.uid();

    -- Check permissions
    IF v_viewer_role NOT IN ('Detective', 'Coordinador', 'Administrador', 'Comisionado') THEN
        RAISE EXCEPTION 'Access Denied: You are not authorized to update agent licenses';
    END IF;

    -- Update target user's licenses
    UPDATE public.users
    SET 
        licenses = COALESCE(p_licenses, '{}'),
        updated_at = NOW()
    WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.update_user_licenses TO authenticated;

-- 4. Re-create / Update update_personnel_admin to support licenses
CREATE OR REPLACE FUNCTION public.update_personnel_admin(
  p_user_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_no_placa TEXT,
  p_rango app_rank,
  p_rol app_role,
  p_fecha_ingreso TIMESTAMP WITH TIME ZONE,
  p_fecha_ultimo_ascenso TIMESTAMP WITH TIME ZONE,
  p_profile_image TEXT,
  p_divisions TEXT[] DEFAULT NULL,
  p_rango_interno TEXT DEFAULT NULL,
  p_licenses TEXT[] DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET
    email = p_email,
    nombre = p_nombre,
    apellido = p_apellido,
    no_placa = p_no_placa,
    rango = p_rango,
    rol = p_rol,
    fecha_ingreso = p_fecha_ingreso,
    profile_image = p_profile_image,
    updated_at = NOW(),
    divisions = CASE WHEN p_divisions IS NOT NULL THEN p_divisions ELSE divisions END,
    rango_interno = CASE WHEN p_rango_interno IS NOT NULL AND trim(p_rango_interno) <> '' THEN p_rango_interno ELSE rango_interno END,
    licenses = CASE WHEN p_licenses IS NOT NULL THEN p_licenses ELSE licenses END
  WHERE id = p_user_id;

  UPDATE auth.users SET email = p_email WHERE id = p_user_id;

  IF p_password IS NOT NULL AND trim(p_password) <> '' THEN
     UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf')) WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- 5. Re-create / Update create_new_personnel to support licenses
CREATE OR REPLACE FUNCTION public.create_new_personnel(
  p_email TEXT,
  p_password TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_no_placa TEXT,
  p_rango app_rank,
  p_rol app_role,
  p_fecha_ingreso TIMESTAMP WITH TIME ZONE,
  p_fecha_ultimo_ascenso TIMESTAMP WITH TIME ZONE,
  p_profile_image TEXT,
  p_divisions TEXT[] DEFAULT '{"Detective Bureau"}',
  p_rango_interno TEXT DEFAULT 'Auxiliar de Investigación',
  p_licenses TEXT[] DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-00-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_user_id;

  -- Insert into public.users
  INSERT INTO public.users (
    id,
    email,
    nombre,
    apellido,
    no_placa,
    rango,
    rol,
    fecha_ingreso,
    profile_image,
    divisions,
    rango_interno,
    licenses
  )
  VALUES (
    new_user_id,
    p_email,
    p_nombre,
    p_apellido,
    p_no_placa,
    p_rango,
    p_rol,
    p_fecha_ingreso,
    p_profile_image,
    COALESCE(p_divisions, '{"Detective Bureau"}'),
    COALESCE(NULLIF(trim(p_rango_interno), ''), 'Auxiliar de Investigación'),
    COALESCE(p_licenses, '{}')
  )
  ON CONFLICT (id) DO UPDATE SET
    rango = EXCLUDED.rango,
    rol = EXCLUDED.rol,
    fecha_ingreso = EXCLUDED.fecha_ingreso,
    profile_image = EXCLUDED.profile_image,
    nombre = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    no_placa = EXCLUDED.no_placa,
    divisions = EXCLUDED.divisions,
    rango_interno = EXCLUDED.rango_interno,
    licenses = EXCLUDED.licenses;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.create_new_personnel TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_personnel_admin TO authenticated;
