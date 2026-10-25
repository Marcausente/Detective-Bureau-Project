-- ==============================================================================
-- ACTUALIZACIÓN DE PERMISOS: ROL 'AYUDANTE' EN CASOS
-- Asegura que usuarios con rol 'ayudante' NO puedan ver casos globales,
-- incluso si pertenecen a la división 'Detective Bureau'.
-- Solo pueden ver aquellos casos donde están asignados o que hayan creado.
-- ==============================================================================

-- 1. ACTUALIZAR GET_CASES
DROP FUNCTION IF EXISTS public.get_cases();
DROP FUNCTION IF EXISTS public.get_cases(text);
DROP FUNCTION IF EXISTS public.get_cases(character varying);

CREATE OR REPLACE FUNCTION public.get_cases(p_status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  case_number INT,
  title TEXT,
  status TEXT,
  location TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  assigned_avatars TEXT[],
  is_pinned BOOLEAN
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_role TEXT;
  v_user_rank TEXT;
  v_user_divisions TEXT[];
  v_can_view_all BOOLEAN := false;
BEGIN
  -- Obtener info del usuario actual
  SELECT 
    LOWER(TRIM(rol::text)), 
    LOWER(TRIM(rango::text)), 
    divisions 
  INTO 
    v_user_role, 
    v_user_rank, 
    v_user_divisions 
  FROM public.users 
  WHERE id = v_uid;

  -- IMPORTANTE: Si el rol es 'ayudante', NUNCA puede ver todos los casos automáticamente,
  -- incluso si tiene asignada la división 'Detective Bureau'.
  IF v_user_role != 'ayudante' AND (
     v_user_role IN ('administrador', 'coordinador', 'comisionado', 'detective', 'jefatura')
     OR v_user_role ILIKE '%detective%'
     OR v_user_role ILIKE '%admin%'
     OR v_user_role ILIKE '%jefatura%'
     OR v_user_rank ILIKE '%detective%'
     OR v_user_rank ILIKE '%sargento%'
     OR v_user_rank ILIKE '%teniente%'
     OR v_user_rank ILIKE '%capit%'
     OR v_user_rank ILIKE '%comisario%'
     OR v_user_rank ILIKE '%jefe%'
     OR (v_user_divisions IS NOT NULL AND EXISTS (
         SELECT 1 FROM unnest(v_user_divisions) d WHERE d ILIKE '%detective bureau%'
     ))
  ) THEN
     v_can_view_all := true;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.case_number,
    c.title,
    c.status,
    c.location,
    c.occurred_at,
    c.created_at,
    COALESCE(
      ARRAY(
        SELECT u.profile_image 
        FROM public.case_assignments ca
        JOIN public.users u ON ca.user_id = u.id
        WHERE ca.case_id = c.id
        LIMIT 3
      ), 
      ARRAY[]::TEXT[]
    ) as assigned_avatars,
    COALESCE(c.is_pinned, false) as is_pinned
  FROM public.cases c
  WHERE (p_status_filter IS NULL OR c.status ILIKE p_status_filter)
  AND (
    v_can_view_all
    OR c.created_by = v_uid
    OR EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = c.id AND ca.user_id = v_uid)
  )
  ORDER BY COALESCE(c.is_pinned, false) DESC, c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_cases(TEXT) TO authenticated, service_role, anon;


-- 2. ACTUALIZAR GET_CASE_DETAILS
DROP FUNCTION IF EXISTS public.get_case_details(UUID);
DROP FUNCTION IF EXISTS public.get_case_details(TEXT);

CREATE OR REPLACE FUNCTION public.get_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_case RECORD;
  v_user_role TEXT;
  v_user_rank TEXT;
  v_user_divisions TEXT[];
  v_is_authorized BOOLEAN := false;
  v_assignments JSON;
  v_updates JSON;
  v_interrogations JSON;
  v_incidents JSON;
  v_outings JSON;
  v_complaints JSON;
  v_gangs JSON;
  v_ballistics_coincidences JSON;
  v_ballistics_weapons JSON;
  v_ballistics_bullets JSON;
BEGIN
  -- 1. Verificar si existe el caso
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND OR v_case.id IS NULL THEN
     RETURN NULL;
  END IF;

  -- 2. Permisos: Ayudante SOLO puede ver los casos en los que está asignado o es creador
  SELECT 
    LOWER(TRIM(rol::text)), 
    LOWER(TRIM(rango::text)), 
    divisions 
  INTO 
    v_user_role, 
    v_user_rank, 
    v_user_divisions 
  FROM public.users 
  WHERE id = v_uid;

  IF v_user_role = 'ayudante' THEN
     -- Solo autorizado si está asignado o es el creador
     IF v_case.created_by = v_uid OR EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid) THEN
        v_is_authorized := true;
     ELSE
        v_is_authorized := false;
     END IF;
  ELSE
     -- Otros roles con autorización general o asignación
     IF v_user_role IN ('administrador', 'coordinador', 'comisionado', 'detective', 'jefatura')
        OR v_user_role ILIKE '%detective%'
        OR v_user_role ILIKE '%admin%'
        OR v_user_role ILIKE '%jefatura%'
        OR v_user_rank ILIKE '%detective%'
        OR v_user_rank ILIKE '%sargento%'
        OR v_user_rank ILIKE '%teniente%'
        OR v_user_rank ILIKE '%capit%'
        OR v_user_rank ILIKE '%comisario%'
        OR v_user_rank ILIKE '%jefe%'
        OR (v_user_divisions IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_user_divisions) d WHERE d ILIKE '%detective bureau%'
        ))
        OR v_case.created_by = v_uid
        OR EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid)
     THEN
        v_is_authorized := true;
     END IF;
  END IF;

  IF NOT v_is_authorized THEN
     RAISE EXCEPTION 'Access Denied: Como Ayudante solo puedes ver los casos a los que has sido asignado.';
  END IF;

  -- 3. Asignaciones
  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'full_name', u.nombre || ' ' || u.apellido,
    'rank', u.rango,
    'avatar', u.profile_image,
    'role', COALESCE(ca.role, 'Investigador')
  )) INTO v_assignments
  FROM public.case_assignments ca
  JOIN public.users u ON ca.user_id = u.id
  WHERE ca.case_id = p_case_id;

  -- 4. Actualizaciones / Novedades
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'image', cu.image_url,
    'image_url', cu.image_url,
    'images', cu.images,
    'documents', cu.documents,
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'user_id', cu.author_id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- 5. Interrogatorios vinculados
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'created_at', i.created_at,
    'subjects', i.subjects
  ) ORDER BY i.created_at DESC) INTO v_interrogations
  FROM public.interrogations i
  WHERE i.case_id = p_case_id;

  -- 6. Incidentes vinculados
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'occurred_at', i.occurred_at,
    'location', i.location
  ) ORDER BY i.occurred_at DESC) INTO v_incidents
  FROM public.incidents i
  JOIN public.case_incidents ci ON ci.incident_id = i.id
  WHERE ci.case_id = p_case_id;

  -- 7. Salidas vinculadas
  SELECT json_agg(json_build_object(
    'id', o.id,
    'title', o.title,
    'occurred_at', o.occurred_at
  ) ORDER BY o.occurred_at DESC) INTO v_outings
  FROM public.outings o
  JOIN public.case_outings co ON co.outing_id = o.id
  WHERE co.case_id = p_case_id;

  -- 8. Denuncias vinculadas
  SELECT json_agg(json_build_object(
    'id', d.id,
    'titulo', d.titulo,
    'created_at', d.created_at,
    'status', d.status
  ) ORDER BY d.created_at DESC) INTO v_complaints
  FROM public.denuncias d
  WHERE d.case_id = p_case_id;

  -- 9. Bandas vinculadas
  SELECT json_agg(json_build_object(
    'id', g.id,
    'name', g.name,
    'color', g.color,
    'zones_image', g.zones_image,
    'is_archived', g.is_archived
  ) ORDER BY g.name ASC) INTO v_gangs
  FROM public.gangs g
  JOIN public.case_gangs cg ON cg.gang_id = g.id
  WHERE cg.case_id = p_case_id;

  -- 10. Coincidencias balísticas vinculadas
  SELECT json_agg(json_build_object(
    'id', m.id,
    'weapon_id', w.id,
    'serial_number', w.numero_serie,
    'numero_serie', w.numero_serie,
    'weapon_model', w.modelo,
    'modelo', w.modelo,
    'weapon_owner', w.propietario,
    'propietario', w.propietario,
    'weapon_incident', w.incidente_relacionado,
    'status', m.status,
    'motivo_rechazo', m.motivo_rechazo,
    'updated_at', m.updated_at,
    'bullets_count', (
        SELECT COUNT(*)
        FROM public.ballistics_bullets b
        WHERE LOWER(TRIM(b.numero_serie)) = LOWER(TRIM(w.numero_serie))
    ),
    'bullets', (
        SELECT json_agg(json_build_object(
            'id', b.id,
            'incidente', b.incidente_relacionado,
            'calibre', b.calibre,
            'modelo_arma', b.modelo_arma,
            'created_at', b.created_at
        ))
        FROM public.ballistics_bullets b
        WHERE LOWER(TRIM(b.numero_serie)) = LOWER(TRIM(w.numero_serie))
    )
  ) ORDER BY m.updated_at DESC) INTO v_ballistics_coincidences
  FROM public.ballistics_matches m
  JOIN public.ballistics_weapons w ON m.weapon_id = w.id
  WHERE m.case_id = p_case_id;

  -- 11. Armas balísticas vinculadas
  SELECT json_agg(json_build_object(
    'id', w.id,
    'modelo', w.modelo,
    'numero_serie', w.numero_serie,
    'propietario', w.propietario,
    'incidente_relacionado', w.incidente_relacionado,
    'created_at', w.created_at
  ) ORDER BY w.created_at DESC) INTO v_ballistics_weapons
  FROM public.ballistics_weapons w
  WHERE w.case_id = p_case_id;

  -- 12. Balas balísticas vinculadas
  SELECT json_agg(json_build_object(
    'id', b.id,
    'calibre', b.calibre,
    'numero_serie', b.numero_serie,
    'modelo_arma', b.modelo_arma,
    'incidente_relacionado', b.incidente_relacionado,
    'created_at', b.created_at
  ) ORDER BY b.created_at DESC) INTO v_ballistics_bullets
  FROM public.ballistics_bullets b
  WHERE b.case_id = p_case_id;

  -- Construir respuesta JSON
  RETURN json_build_object(
    'info', row_to_json(v_case),
    'case', row_to_json(v_case),
    'assignments', COALESCE(v_assignments, '[]'::json),
    'updates', COALESCE(v_updates, '[]'::json),
    'interrogations', COALESCE(v_interrogations, '[]'::json),
    'incidents', COALESCE(v_incidents, '[]'::json),
    'outings', COALESCE(v_outings, '[]'::json),
    'complaints', COALESCE(v_complaints, '[]'::json),
    'gangs', COALESCE(v_gangs, '[]'::json),
    'ballistics_coincidences', COALESCE(v_ballistics_coincidences, '[]'::json),
    'ballistics_weapons', COALESCE(v_ballistics_weapons, '[]'::json),
    'ballistics_bullets', COALESCE(v_ballistics_bullets, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_case_details(UUID) TO authenticated, service_role, anon;
