-- =========================================================================
-- FIX DEFINITIVO: Solución al error "Database error querying schema"
-- al iniciar sesión y corrección completa de creación de usuarios
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Eliminar versiones anteriores de la función
DROP FUNCTION IF EXISTS public.create_new_personnel(TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT);
DROP FUNCTION IF EXISTS public.create_new_personnel(TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_new_personnel(TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.create_new_personnel(TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT, TEXT[]);

-- 2. Asegurar que el rango 'ASD Agent' está en el ENUM app_rank (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_rank') THEN
        ALTER TYPE app_rank ADD VALUE IF NOT EXISTS 'ASD Agent';
    END IF;
END $$;

-- 3. Crear la función create_new_personnel con inserción completa en auth.users y auth.identities
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
  new_user_id := gen_random_uuid();

  -- 1. Insertar en auth.users con todos los campos requeridos por Supabase GoTrue
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    null,
    null,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('nombre', p_nombre, 'apellido', p_apellido, 'no_placa', p_no_placa),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- 2. Insertar en auth.identities (IMPRESCINDIBLE para el inicio de sesión en Supabase)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_user_id,
    format('{"sub": "%s", "email": "%s"}', new_user_id::text, p_email)::jsonb,
    'email',
    new_user_id::text,
    null,
    NOW(),
    NOW()
  );

  -- 3. Insertar en public.users
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
    COALESCE(p_fecha_ingreso, NOW()),
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

-- 4. Asignar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.create_new_personnel(TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT, TEXT[]) TO authenticated;

-- =========================================================================
-- 5. REPARACIÓN AUTOMÁTICA DE USUARIOS EXISTENTES
-- Esto repara la cuenta creada previamente que no podía iniciar sesión
-- =========================================================================
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  u.id,
  format('{"sub": "%s", "email": "%s"}', u.id::text, u.email)::jsonb,
  'email',
  u.id::text,
  null,
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);
