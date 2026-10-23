-- ==============================================================================
-- SISTEMA DE DELEGACIÓN DE PERMISOS PARA CREACIÓN DE PERSONAL
-- Permite que los administradores autoricen a usuarios específicos a crear nuevo
-- personal con rol fijo en 'Ayudante' y con divisiones limitadas a las autorizadas.
-- ==============================================================================

-- 1. Crear tabla de delegaciones de creación de personal
CREATE TABLE IF NOT EXISTS public.personnel_creator_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    allowed_divisions TEXT[] NOT NULL DEFAULT '{}',
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_delegation UNIQUE (user_id)
);

-- 2. Activar Row Level Security
ALTER TABLE public.personnel_creator_delegations ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.personnel_creator_delegations;
CREATE POLICY "Allow select for authenticated"
  ON public.personnel_creator_delegations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all for admins" ON public.personnel_creator_delegations;
CREATE POLICY "Allow all for admins"
  ON public.personnel_creator_delegations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.rol IN ('Comisionado', 'Coordinador', 'Administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.rol IN ('Comisionado', 'Coordinador', 'Administrador')
    )
  );

GRANT ALL ON public.personnel_creator_delegations TO authenticated;
GRANT ALL ON public.personnel_creator_delegations TO service_role;

-- 4. RPCs de Gestión para Administradores
CREATE OR REPLACE FUNCTION public.set_personnel_creator_delegation(
    p_target_user_id UUID,
    p_allowed_divisions TEXT[]
)
RETURNS VOID AS $$
DECLARE
    caller_role app_role;
BEGIN
    SELECT rol INTO caller_role FROM public.users WHERE id = auth.uid();
    IF caller_role NOT IN ('Comisionado', 'Coordinador', 'Administrador') THEN
        RAISE EXCEPTION 'Solo los administradores pueden otorgar permisos de creación de personal.';
    END IF;

    INSERT INTO public.personnel_creator_delegations (user_id, allowed_divisions, granted_by, updated_at)
    VALUES (p_target_user_id, p_allowed_divisions, auth.uid(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        allowed_divisions = EXCLUDED.allowed_divisions,
        granted_by = EXCLUDED.granted_by,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.revoke_personnel_creator_delegation(
    p_target_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    caller_role app_role;
BEGIN
    SELECT rol INTO caller_role FROM public.users WHERE id = auth.uid();
    IF caller_role NOT IN ('Comisionado', 'Coordinador', 'Administrador') THEN
        RAISE EXCEPTION 'Solo los administradores pueden revocar permisos de creación de personal.';
    END IF;

    DELETE FROM public.personnel_creator_delegations WHERE user_id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.set_personnel_creator_delegation(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_personnel_creator_delegation(UUID) TO authenticated;

-- 5. Actualizar la función create_new_personnel con validación de seguridad para usuarios delegados
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
  caller_id UUID;
  caller_role app_role;
  caller_allowed_divisions TEXT[];
  v_rol app_role := p_rol;
  v_divisions TEXT[] := COALESCE(p_divisions, '{"Detective Bureau"}');
  is_admin BOOLEAN := false;
BEGIN
  caller_id := auth.uid();

  -- Verificación de seguridad si la llamada proviene de un usuario autenticado
  IF caller_id IS NOT NULL THEN
    SELECT rol INTO caller_role FROM public.users WHERE id = caller_id;

    IF caller_role IN ('Comisionado', 'Coordinador', 'Administrador') THEN
      is_admin := true;
    ELSIF caller_role LIKE 'Coordinador %' THEN
      -- Coordinadores de división fijos: rol forzado a 'Ayudante'
      v_rol := 'Ayudante'::app_role;
    ELSE
      -- Comprobar si tiene delegación autorizada por un administrador
      SELECT allowed_divisions INTO caller_allowed_divisions
      FROM public.personnel_creator_delegations
      WHERE user_id = caller_id;

      IF FOUND THEN
        -- Rol de sistema forzado estrictamente a 'Ayudante'
        v_rol := 'Ayudante'::app_role;

        -- Validar que no asigne divisiones no permitidas
        IF v_divisions IS NOT NULL AND array_length(v_divisions, 1) > 0 THEN
          IF NOT (v_divisions <@ caller_allowed_divisions) THEN
            RAISE EXCEPTION 'No tienes autorización para asignar una o más de las divisiones indicadas.';
          END IF;
        ELSE
          v_divisions := caller_allowed_divisions;
        END IF;
      ELSE
        RAISE EXCEPTION 'No tienes permiso para crear personal en el sistema.';
      END IF;
    END IF;
  END IF;

  new_user_id := gen_random_uuid();

  -- 1. Insertar en auth.users
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

  -- 2. Insertar en auth.identities
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
    v_rol,
    COALESCE(p_fecha_ingreso, NOW()),
    p_profile_image,
    v_divisions,
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
