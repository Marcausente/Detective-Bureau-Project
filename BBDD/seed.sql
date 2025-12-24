-- Semilla completa: Crea el usuario en auth.users Y le asigna los datos de perfil
-- ADVERTENCIA: Insertar directamente en auth.users es "hacky" pero funciona para desarrollo.
-- La contraseña será: "password123"

-- 1. Aseguramos que existe la extensión para encriptar contraseñas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Variables para el usuario
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  user_email text := 'gerogevance@lspd.com';
  user_password text := 'password123';
BEGIN
  -- Verificar si el usuario ya existe en auth.users para no duplicar
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    
    -- Insertar en auth.users (Esto permite el Login)
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
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      user_email,
      crypt(user_password, gen_salt('bf')), -- Contraseña encriptada
      now(), -- Email confirmado automáticamente
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- El Trigger 'on_auth_user_created' que creamos en users.sql debería saltar automáticamente
    -- y crear la fila vacía en public.users.
    -- Pero como estamos en el mismo bloque de transacción, esperaremos un momento o actualizamos directamente.
    
    -- Nota: A veces los triggers no saltan igual en inserciones manuales directas si no se commitean, 
    -- pero en Supabase SQL Editor suelen ir bien.
    -- Por seguridad, hacemos un UPDATE manual a la tabla users asumiendo que el trigger funcionó
    -- O hacemos un INSERT ON CONFLICT por si el trigger falló o no saltó.

    INSERT INTO public.users (id, email, nombre, apellido, no_placa, rango, rol)
    VALUES (
      new_user_id, 
      user_email, 
      'George', 
      'Vance', 
      '763', 
      'Detective II', 
      'Administrador'
    )
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      apellido = EXCLUDED.apellido,
      no_placa = EXCLUDED.no_placa,
      rango = EXCLUDED.rango,
      rol = EXCLUDED.rol;
      
  ELSE
    -- Si ya existe, solo actualizamos su perfil público
    UPDATE public.users 
    SET 
      nombre = 'George',
      apellido = 'Vance',
      no_placa = '763',
      rango = 'Detective II',
      rol = 'Administrador'
    WHERE email = user_email;
  END IF;
END $$;
