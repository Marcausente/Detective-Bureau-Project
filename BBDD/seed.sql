-- Simplificado: Solo actualiza el perfil de George Vance con la fecha de ingreso correcta.
-- Asegúrate de que el usuario 'georgevance@lspd.com' ya exista en Authentication.

UPDATE public.users 
SET 
  nombre = 'George',
  apellido = 'Vance',
  no_placa = '763',
  rango = 'Detective II',
  rol = 'Administrador',
  fecha_ingreso = '2025-11-08',
  updated_at = now()
WHERE email = 'georgevance@lspd.com';
