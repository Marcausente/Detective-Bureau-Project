-- Actualizar la regla de visibilidad de los interrogatorios para incluir a las personas asignadas.

-- 1. Asegurarnos de que el RLS lo permita:
DROP POLICY IF EXISTS "RLS_Interrogations_Select" ON public.interrogations;
CREATE POLICY "RLS_Interrogations_Select" ON public.interrogations
FOR SELECT USING (
  (SELECT rol FROM public.users WHERE id = auth.uid()) IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador')
  OR
  author_id = auth.uid()
  OR
  agents_present ILIKE '%' || (SELECT nombre || ' ' || apellido FROM public.users WHERE id = auth.uid()) || '%'
);

-- 2. Modificar la función get_interrogations() para que aplique esta misma lógica:
CREATE OR REPLACE FUNCTION get_interrogations()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  author_id UUID,
  author_name TEXT,
  title TEXT,
  interrogation_date DATE,
  agents_present TEXT,
  subjects TEXT,
  transcription TEXT,
  media_url TEXT,
  can_edit BOOLEAN
) AS $$
DECLARE
  v_user_role app_role;
  v_user_id UUID;
  v_user_full_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT rol, (nombre || ' ' || apellido) INTO v_user_role, v_user_full_name 
  FROM public.users u WHERE u.id = v_user_id;

  RETURN QUERY
  SELECT 
    i.id,
    i.created_at,
    i.author_id,
    (u.nombre || ' ' || u.apellido) as author_name,
    i.title,
    i.interrogation_date,
    i.agents_present,
    i.subjects,
    i.transcription,
    i.media_url,
    -- Determine if current user can edit this specific row
    (v_user_role IN ('Coordinador', 'Comisionado', 'Administrador') OR i.author_id = v_user_id) as can_edit
  FROM public.interrogations i
  LEFT JOIN public.users u ON i.author_id = u.id
  WHERE 
    CASE 
      WHEN v_user_role IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN TRUE
      ELSE (i.author_id = v_user_id OR i.agents_present ILIKE '%' || v_user_full_name || '%')
    END
  ORDER BY i.interrogation_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
