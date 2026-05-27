-- ============================================================
-- Actualizar permisos de interrogatorios para el rol Externo (Invitado)
-- Los Invitados (Externo en DB) deben poder:
--   1. Subir (crear) nuevos interrogatorios
--   2. Ver los interrogatorios en los que están presentes (como agentes) o que ellos crearon
-- ============================================================

-- 1. Actualizar la política RLS para incluir Externo con la misma lógica de visibilidad
DROP POLICY IF EXISTS "RLS_Interrogations_Select" ON public.interrogations;
CREATE POLICY "RLS_Interrogations_Select" ON public.interrogations
FOR SELECT USING (
  -- Roles con acceso total
  (SELECT rol FROM public.users WHERE id = auth.uid()) IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador')
  OR
  -- Autor del interrogatorio (cualquier rol)
  author_id = auth.uid()
  OR
  -- Aparece como agente presente (cualquier rol, incluye Externo/Invitado)
  agents_present ILIKE '%' || (SELECT nombre || ' ' || apellido FROM public.users WHERE id = auth.uid()) || '%'
);

-- 2. Actualizar la política RLS de INSERT para permitir que Externo pueda crear interrogatorios
DROP POLICY IF EXISTS "RLS_Interrogations_Insert" ON public.interrogations;
CREATE POLICY "RLS_Interrogations_Insert" ON public.interrogations
FOR INSERT WITH CHECK (
  -- Cualquier usuario autenticado puede crear (el RPC manage_interrogation también controla esto)
  auth.uid() IS NOT NULL
);

-- 3. Recrear get_interrogations() con soporte para Externo
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
  v_user_role TEXT;
  v_user_id UUID;
  v_user_full_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT u.rol::text, (u.nombre || ' ' || u.apellido) INTO v_user_role, v_user_full_name
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
    -- Solo puede editar si es Coordinador/Comisionado/Admin O si es el autor
    (v_user_role IN ('Coordinador', 'Comisionado', 'Administrador') OR i.author_id = v_user_id) as can_edit
  FROM public.interrogations i
  LEFT JOIN public.users u ON i.author_id = u.id
  WHERE 
    CASE 
      -- Roles con acceso total: ven todos
      WHEN v_user_role IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN TRUE
      -- Externo/Invitado y Ayudante: solo ven los propios o los que aparecen como presentes
      ELSE (
        i.author_id = v_user_id 
        OR (v_user_full_name IS NOT NULL AND i.agents_present ILIKE '%' || v_user_full_name || '%')
      )
    END
  ORDER BY i.interrogation_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar manage_interrogation() para que Externo pueda crear pero NO editar/eliminar los de otros
CREATE OR REPLACE FUNCTION manage_interrogation(
  p_action TEXT, -- 'create', 'update', 'delete'
  p_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_date DATE DEFAULT NULL,
  p_agents TEXT DEFAULT NULL,
  p_subjects TEXT DEFAULT NULL,
  p_transcription TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_user_role TEXT;
  v_author_id UUID;
BEGIN
  SELECT u.rol::text INTO v_user_role FROM public.users u WHERE u.id = auth.uid();

  -- Get author of the target post if updating/deleting
  IF p_id IS NOT NULL THEN
    SELECT author_id INTO v_author_id FROM public.interrogations WHERE id = p_id;
  END IF;

  IF p_action = 'create' THEN
    -- Cualquier usuario autenticado puede crear un interrogatorio (incluye Externo/Invitado)
    INSERT INTO public.interrogations (author_id, title, interrogation_date, agents_present, subjects, transcription, media_url)
    VALUES (auth.uid(), p_title, p_date, p_agents, p_subjects, p_transcription, p_url);
    
  ELSIF p_action = 'update' THEN
    -- Admins/Coord/Comis pueden editar cualquiera; el autor puede editar el suyo propio
    IF v_user_role IN ('Coordinador', 'Comisionado', 'Administrador') OR v_author_id = auth.uid() THEN
        UPDATE public.interrogations
        SET title = p_title, interrogation_date = p_date, agents_present = p_agents, subjects = p_subjects, transcription = p_transcription, media_url = p_url
        WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You cannot edit this interrogation.';
    END IF;
    
  ELSIF p_action = 'delete' THEN
    -- Admins/Coord/Comis pueden eliminar cualquiera; el autor puede eliminar el suyo propio
    IF v_user_role IN ('Coordinador', 'Comisionado', 'Administrador') OR v_author_id = auth.uid() THEN
        DELETE FROM public.interrogations WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Access Denied: You cannot delete this interrogation.';
    END IF;
    
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Conceder permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_interrogations TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_interrogation TO authenticated;
