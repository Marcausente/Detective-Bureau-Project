-- ==============================================================================
-- FIX INMEDIATO DE VISIBILIDAD DE CASOS (GET_CASES Y GET_CASE_DETAILS)
-- Ejecutar en Supabase SQL Editor para asegurar que todos los casos se listen y abran
-- ==============================================================================

-- 1. ACTUALIZAR GET_CASES
DROP FUNCTION IF EXISTS public.get_cases(text);

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
BEGIN
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
  ORDER BY COALESCE(c.is_pinned, false) DESC, c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_cases(TEXT) TO authenticated, service_role, anon;


-- 2. ACTUALIZAR GET_CASE_DETAILS
DROP FUNCTION IF EXISTS public.get_case_details(UUID);

CREATE OR REPLACE FUNCTION public.get_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_case RECORD;
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
  IF v_case IS NULL THEN
     RAISE EXCEPTION 'Case not found';
  END IF;

  -- 2. Asignaciones
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

  -- 3. Actualizaciones / Novedades
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'image_url', cu.image_url,
    'images', cu.images,
    'documents', cu.documents,
    'created_at', cu.created_at,
    'author_name', u.nombre || ' ' || u.apellido,
    'author_rank', u.rango,
    'author_avatar', u.profile_image
  ) ORDER BY cu.created_at ASC) INTO v_updates
  FROM public.case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- 4. Interrogatorios vinculados
  SELECT json_agg(json_build_object(
    'id', i.id,
    'full_name', i.full_name,
    'dni', i.dni,
    'image_url', i.image_url,
    'interrogator_id', i.interrogator_id,
    'crime', i.crime,
    'created_at', i.created_at
  )) INTO v_interrogations
  FROM public.interrogations i
  WHERE i.case_id = p_case_id;

  -- 5. Incidentes vinculados
  SELECT json_agg(json_build_object(
    'id', inc.id,
    'incident_number', inc.incident_number,
    'title', inc.title,
    'location', inc.location,
    'incident_date', inc.incident_date,
    'classification', inc.classification
  )) INTO v_incidents
  FROM public.case_incidents ci
  JOIN public.incidents inc ON ci.incident_id = inc.id
  WHERE ci.case_id = p_case_id;

  -- 6. Salidas vinculadas
  SELECT json_agg(json_build_object(
    'id', o.id,
    'name', o.name,
    'date', o.date,
    'reason', o.reason
  )) INTO v_outings
  FROM public.case_outings co
  JOIN public.outings o ON co.outing_id = o.id
  WHERE co.case_id = p_case_id;

  -- 7. Denuncias vinculadas
  SELECT json_agg(json_build_object(
    'id', c.id,
    'folio_number', c.folio_number,
    'affair', c.affair,
    'date', c.date,
    'status', c.status
  )) INTO v_complaints
  FROM public.case_complaints cc
  JOIN public.complaints c ON cc.complaint_id = c.id
  WHERE cc.case_id = p_case_id;

  -- 8. Bandas vinculadas
  SELECT json_agg(json_build_object(
    'id', g.id,
    'name', g.name,
    'banner_url', g.banner_url,
    'color', g.color,
    'status', g.status
  )) INTO v_gangs
  FROM public.case_gangs cg
  JOIN public.gangs g ON cg.gang_id = g.id
  WHERE cg.case_id = p_case_id;

  -- 9. Coincidencias balísticas vinculadas
  SELECT json_agg(json_build_object(
    'id', bc.id,
    'match_name', bc.match_name,
    'caliber', bc.caliber,
    'created_at', bc.created_at,
    'linked_at', cbc.linked_at
  )) INTO v_ballistics_coincidences
  FROM public.case_ballistics_coincidences cbc
  JOIN public.ballistics_coincidences bc ON cbc.coincidence_id = bc.id
  WHERE cbc.case_id = p_case_id;

  -- 10. Armas balísticas vinculadas
  SELECT json_agg(json_build_object(
    'id', bw.id,
    'weapon_name', bw.weapon_name,
    'serial_number', bw.serial_number,
    'caliber', bw.caliber,
    'created_at', bw.created_at,
    'linked_at', cbw.linked_at
  )) INTO v_ballistics_weapons
  FROM public.case_ballistics_weapons cbw
  JOIN public.ballistics_weapons bw ON cbw.weapon_id = bw.id
  WHERE cbw.case_id = p_case_id;

  -- 11. Balas balísticas vinculadas
  SELECT json_agg(json_build_object(
    'id', bb.id,
    'caliber', bb.caliber,
    'location', bb.location,
    'date_found', bb.date_found,
    'created_at', bb.created_at,
    'linked_at', cbb.linked_at
  )) INTO v_ballistics_bullets
  FROM public.case_ballistics_bullets cbb
  JOIN public.ballistics_bullets bb ON cbb.bullet_id = bb.id
  WHERE cbb.case_id = p_case_id;

  -- Construir respuesta JSON
  RETURN json_build_object(
    'case', json_build_object(
      'id', v_case.id,
      'case_number', v_case.case_number,
      'title', v_case.title,
      'status', v_case.status,
      'location', v_case.location,
      'occurred_at', v_case.occurred_at,
      'description', v_case.description,
      'created_at', v_case.created_at,
      'image_url', v_case.image_url,
      'documents', v_case.documents,
      'is_pinned', COALESCE(v_case.is_pinned, false)
    ),
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
