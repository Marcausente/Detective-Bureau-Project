-- ==============================================================================
-- ACTUALIZACIÓN DEL SISTEMA DE DELEGACIÓN Y ELIMINACIÓN DE ROLES OBSOLETOS
-- 1. Permite a los usuarios autorizados (creadores delegados) editar perfiles
--    ya existentes en personal y añadir/quitar únicamente las divisiones que
--    tienen autorizadas, preservando el rol de sistema y las demás divisiones.
-- 2. Elimina los roles obsoletos de sistema: 'Coordinador IA', 'Coordinador ASD',
--    'Coordinador SWAT/SEB', 'Coordinador SEB', 'Coordinador DOJ', migrando
--    los usuarios afectados a rol 'Ayudante' y garantizando su asignación divisional.
-- ==============================================================================

-- 1. Migración de datos: asegurar divisiones asignadas y migrar rol a 'Ayudante'
UPDATE public.users
SET divisions = ARRAY(
    SELECT DISTINCT elem FROM unnest(COALESCE(divisions, '{}') || ARRAY['Internal Affairs']) AS elem
)
WHERE rol::TEXT = 'Coordinador IA';

UPDATE public.users
SET divisions = ARRAY(
    SELECT DISTINCT elem FROM unnest(COALESCE(divisions, '{}') || ARRAY['ASD']) AS elem
)
WHERE rol::TEXT = 'Coordinador ASD';

UPDATE public.users
SET divisions = ARRAY(
    SELECT DISTINCT elem FROM unnest(COALESCE(divisions, '{}') || ARRAY['SEB']) AS elem
)
WHERE rol::TEXT IN ('Coordinador SEB', 'Coordinador SWAT/SEB');

UPDATE public.users
SET divisions = ARRAY(
    SELECT DISTINCT elem FROM unnest(COALESCE(divisions, '{}') || ARRAY['DOJ']) AS elem
)
WHERE rol::TEXT = 'Coordinador DOJ';

-- Actualizar el rol de sistema a 'Ayudante' para estos usuarios
UPDATE public.users
SET rol = 'Ayudante'::app_role
WHERE rol::TEXT IN ('Coordinador IA', 'Coordinador ASD', 'Coordinador SWAT/SEB', 'Coordinador SEB', 'Coordinador DOJ');


-- 2. Actualizar update_personnel_admin para soportar Creadores Delegados
DROP FUNCTION IF EXISTS public.update_personnel_admin(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT);
DROP FUNCTION IF EXISTS public.update_personnel_admin(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.update_personnel_admin(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.update_personnel_admin(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT, TEXT[]);

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
DECLARE
  caller_id UUID := auth.uid();
  caller_role app_role;
  caller_allowed_divisions TEXT[];
  target_existing_divisions TEXT[];
  target_existing_rol app_role;
  v_final_divisions TEXT[];
  v_final_rol app_role := p_rol;
  is_admin BOOLEAN := false;
BEGIN
  -- Verificación de permisos si la llamada proviene de un usuario autenticado
  IF caller_id IS NOT NULL THEN
    SELECT rol INTO caller_role FROM public.users WHERE id = caller_id;
    
    IF caller_role::TEXT IN ('Comisionado', 'Coordinador', 'Administrador') THEN
      is_admin := true;
      v_final_divisions := p_divisions;
    ELSE
      -- Verificar si el usuario que llama tiene delegación activa
      SELECT allowed_divisions INTO caller_allowed_divisions
      FROM public.personnel_creator_delegations
      WHERE user_id = caller_id;

      IF FOUND THEN
        -- Obtener datos actuales del usuario a editar
        SELECT divisions, rol INTO target_existing_divisions, target_existing_rol
        FROM public.users WHERE id = p_user_id;

        -- El creador delegado NO puede modificar el rol del sistema
        v_final_rol := target_existing_rol;

        -- Manejo inteligente de divisiones:
        -- Se conservan las divisiones que el usuario ya tenía fuera del alcance del creador,
        -- y se actualizan (quitan o ponen) únicamente las que el creador tiene permitidas.
        IF p_divisions IS NOT NULL THEN
          SELECT ARRAY(
            SELECT DISTINCT elem FROM (
              -- Divisiones preexistentes que el creador NO tiene permiso de tocar
              SELECT unnest(COALESCE(target_existing_divisions, '{}')) AS elem
              EXCEPT
              SELECT unnest(caller_allowed_divisions)
              UNION
              -- Divisiones asignadas por el creador dentro de sus autorizadas
              SELECT unnest(p_divisions)
              INTERSECT
              SELECT unnest(caller_allowed_divisions)
            ) sub
          ) INTO v_final_divisions;
        ELSE
          v_final_divisions := target_existing_divisions;
        END IF;
      ELSE
        RAISE EXCEPTION 'No tienes permisos para editar personal en el sistema.';
      END IF;
    END IF;
  ELSE
    -- Llamada de servicio o directa
    v_final_divisions := p_divisions;
  END IF;

  -- Actualizar registro en public.users
  UPDATE public.users
  SET
    email = p_email,
    nombre = p_nombre,
    apellido = p_apellido,
    no_placa = p_no_placa,
    rango = p_rango,
    rol = v_final_rol,
    fecha_ingreso = p_fecha_ingreso,
    profile_image = p_profile_image,
    updated_at = NOW(),
    divisions = CASE WHEN v_final_divisions IS NOT NULL THEN v_final_divisions ELSE divisions END,
    rango_interno = CASE WHEN p_rango_interno IS NOT NULL AND trim(p_rango_interno) <> '' THEN p_rango_interno ELSE rango_interno END,
    licenses = CASE WHEN p_licenses IS NOT NULL THEN p_licenses ELSE licenses END
  WHERE id = p_user_id;

  -- Actualizar correo en auth.users si cambió
  UPDATE auth.users SET email = p_email WHERE id = p_user_id;

  -- Actualizar contraseña en auth.users si fue proporcionada
  IF p_password IS NOT NULL AND trim(p_password) <> '' THEN
     UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf')) WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.update_personnel_admin(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT, TEXT[]) TO authenticated;


-- 3. Actualizar create_new_personnel limpiando roles de coordinador obsoletos
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

  IF caller_id IS NOT NULL THEN
    SELECT rol INTO caller_role FROM public.users WHERE id = caller_id;

    IF caller_role::TEXT IN ('Comisionado', 'Coordinador', 'Administrador') THEN
      is_admin := true;
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

GRANT EXECUTE ON FUNCTION public.create_new_personnel(TEXT, TEXT, TEXT, TEXT, TEXT, app_rank, app_role, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TEXT[], TEXT, TEXT[]) TO authenticated;
