-- ==============================================================================
-- CORRECCIÓN: ACCESO A CASOS PARA DETECTIVE BUREAU Y EVALUACIONES POR RANGO DE MALLA
-- 1. Permite ver y abrir casos a cualquier usuario que pertenezca a la división
--    'Detective Bureau' o tenga rango de Detective/Sargento, independientemente de su rol.
-- 2. Actualiza la función de jerarquía de rango (get_rank_level) y verificación
--    de evaluaciones (check_evaluation_access) para que Detective I y superiores
--    puedan evaluar sin errores a todos los rangos inferiores (Oficiales, FTO, Deputy).
-- ==============================================================================

-- 1. FUNCIÓN DE RANGO ROBUSTA (Acepta TEXT para compatibilidad total)
CREATE OR REPLACE FUNCTION public.get_rank_level(r TEXT) RETURNS INTEGER AS $$
DECLARE
    clean_r TEXT;
BEGIN
    IF r IS NULL THEN
        RETURN 0;
    END IF;
    clean_r := lower(trim(r));
    
    RETURN CASE
        WHEN clean_r = 'sheriff' THEN 150
        WHEN clean_r = 'undersheriff' THEN 140
        WHEN clean_r = 'assistant sheriff' THEN 130
        WHEN clean_r = 'division chief' THEN 120
        WHEN clean_r = 'comandante' THEN 110
        WHEN clean_r = 'capitan' THEN 100
        WHEN clean_r = 'teniente' THEN 90
        WHEN clean_r IN ('internal affairs agent', 'department of justice agent', 'seb agent', 'asd agent') THEN 85
        WHEN clean_r LIKE '%agent%' THEN 85
        WHEN clean_r = 'detective iii' OR clean_r = 'detective 3' THEN 80
        WHEN clean_r = 'sargento ii' OR clean_r = 'sargento 2' THEN 75
        WHEN clean_r = 'detective ii' OR clean_r = 'detective 2' THEN 70
        WHEN clean_r = 'sargento i' OR clean_r = 'sargento 1' THEN 65
        WHEN clean_r = 'detective i' OR clean_r = 'detective 1' OR clean_r = 'detective' THEN 60
        WHEN clean_r = 'fto' THEN 52
        WHEN clean_r = 'oficial iii+' OR clean_r = 'oficial 3+' THEN 50
        WHEN clean_r = 'oficial iii' OR clean_r = 'oficial 3' THEN 40
        WHEN clean_r = 'deputy sheriff bonus ii' THEN 35
        WHEN clean_r = 'oficial ii' OR clean_r = 'oficial 2' THEN 30
        WHEN clean_r = 'deputy sheriff bonus i' THEN 20
        WHEN clean_r = 'oficial i' OR clean_r = 'oficial 1' THEN 15
        WHEN clean_r = 'deputy sheriff' THEN 10
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sobrecarga para app_rank si existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_rank') THEN
        CREATE OR REPLACE FUNCTION public.get_rank_level(r app_rank) RETURNS INTEGER AS $func$
        BEGIN
            RETURN public.get_rank_level(r::TEXT);
        END;
        $func$ LANGUAGE plpgsql IMMUTABLE;
    END IF;
END $$;


-- 2. VERIFICACIÓN DE ACCESO A EVALUACIONES (CHECK_EVALUATION_ACCESS)
CREATE OR REPLACE FUNCTION public.check_evaluation_access(viewer_id UUID, target_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    viewer_rank TEXT;
    viewer_role TEXT;
    target_rank TEXT;
    v_level INT;
    t_level INT;
BEGIN
    IF viewer_id IS NULL OR target_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Un usuario no se evalúa a sí mismo
    IF viewer_id = target_id THEN
        RETURN FALSE;
    END IF;

    -- Obtener rango y rol
    SELECT rango::text, rol::text INTO viewer_rank, viewer_role FROM public.users WHERE id = viewer_id;
    SELECT rango::text INTO target_rank FROM public.users WHERE id = target_id;

    -- Mandos altos pueden evaluar siempre
    IF viewer_role IN ('Administrador', 'Comisionado', 'Coordinador') THEN
        RETURN TRUE;
    END IF;

    IF viewer_rank IS NULL OR target_rank IS NULL THEN
        RETURN FALSE;
    END IF;

    v_level := public.get_rank_level(viewer_rank);
    t_level := public.get_rank_level(target_rank);

    -- El evaluador debe tener un rango estrictamente superior al evaluado
    RETURN v_level > t_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RECREAR ADD_EVALUATION Y GET_EVALUATIONS
DROP FUNCTION IF EXISTS public.add_evaluation(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.add_evaluation(p_target_user_id UUID, p_content TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.check_evaluation_access(auth.uid(), p_target_user_id) THEN
     RAISE EXCEPTION 'Access Denied: Level insufficient for creating evaluation.';
  END IF;

  INSERT INTO public.evaluations (target_user_id, author_user_id, content)
  VALUES (p_target_user_id, auth.uid(), p_content);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.get_evaluations(UUID);
CREATE OR REPLACE FUNCTION public.get_evaluations(p_target_user_id UUID)
RETURNS TABLE (
  id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  author_name TEXT,
  author_rank TEXT
) AS $$
BEGIN
  IF NOT public.check_evaluation_access(auth.uid(), p_target_user_id) THEN
     RAISE EXCEPTION 'Access Denied: Level insufficient for viewing evaluations.';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.content,
    e.created_at,
    (u.nombre || ' ' || u.apellido)::text as author_name,
    u.rango::text as author_rank
  FROM public.evaluations e
  LEFT JOIN public.users u ON e.author_user_id = u.id
  WHERE e.target_user_id = p_target_user_id
  ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.delete_evaluation(UUID);
CREATE OR REPLACE FUNCTION public.delete_evaluation(p_evaluation_id UUID)
RETURNS VOID AS $$
DECLARE
  v_viewer_id UUID;
  v_viewer_rank TEXT;
  v_viewer_role TEXT;
  v_author_user_id UUID;
BEGIN
  v_viewer_id := auth.uid();
  IF v_viewer_id IS NULL THEN
     RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT rango::text, rol::text INTO v_viewer_rank, v_viewer_role FROM public.users WHERE id = v_viewer_id;
  SELECT author_user_id INTO v_author_user_id FROM public.evaluations WHERE id = p_evaluation_id;

  IF v_viewer_id = v_author_user_id 
     OR v_viewer_role IN ('Administrador', 'Comisionado', 'Coordinador') 
     OR public.get_rank_level(v_viewer_rank) >= 60 THEN
     DELETE FROM public.evaluations WHERE id = p_evaluation_id;
  ELSE
     RAISE EXCEPTION 'Access Denied: Only author, Detective I or higher can delete evaluations.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_rank_level(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_evaluation_access(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_evaluation(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_evaluations(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_evaluation(UUID) TO authenticated, service_role;


-- 4. ACTUALIZAR GET_CASES PARA INCLUIR DETECTIVE BUREAU POR DIVISIÓN Y RANGO
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
  v_user_role TEXT;
  v_user_rank TEXT;
  v_user_divisions TEXT[];
  v_is_db_member BOOLEAN := false;
BEGIN
  -- Obtener información del usuario autenticado
  SELECT 
    TRIM(rol::text), 
    rango::text, 
    divisions 
  INTO 
    v_user_role, 
    v_user_rank, 
    v_user_divisions 
  FROM public.users 
  WHERE id = v_uid;

  -- Comprobar si es miembro de Detective Bureau, Mando o Detective
  IF v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')
     OR v_user_role ILIKE '%Detective%'
     OR v_user_rank ILIKE '%Detective%'
     OR v_user_rank ILIKE '%Sargento%'
     OR (v_user_divisions IS NOT NULL AND 'Detective Bureau' = ANY(v_user_divisions))
  THEN
     v_is_db_member := true;
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
  WHERE (p_status_filter IS NULL OR c.status = p_status_filter)
  AND (
      v_is_db_member
      OR (c.created_by = v_uid) 
      OR (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = c.id AND ca.user_id = v_uid))
  )
  ORDER BY COALESCE(c.is_pinned, false) DESC, c.case_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_cases(TEXT) TO authenticated, service_role;


-- 5. ACTUALIZAR GET_CASE_DETAILS PARA COMPATIBILIDAD CON DETECTIVE BUREAU
DROP FUNCTION IF EXISTS public.get_case_details(UUID);
CREATE OR REPLACE FUNCTION public.get_case_details(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
  v_uid UUID;
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
  v_is_authorized BOOLEAN := false;
  v_user_role TEXT;
  v_user_rank TEXT;
  v_user_divisions TEXT[];
BEGIN
  v_uid := auth.uid();

  -- 1. Verificar si existe el caso
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN
     RAISE EXCEPTION 'Case not found';
  END IF;

  -- 2. Comprobación de autorización
  SELECT 
    TRIM(rol::text), 
    rango::text, 
    divisions 
  INTO 
    v_user_role, 
    v_user_rank, 
    v_user_divisions 
  FROM public.users 
  WHERE id = v_uid;

  v_is_authorized := 
      (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR
      (v_user_role ILIKE '%Detective%') OR
      (v_user_rank ILIKE '%Detective%') OR
      (v_user_rank ILIKE '%Sargento%') OR
      (v_user_divisions IS NOT NULL AND 'Detective Bureau' = ANY(v_user_divisions)) OR
      (v_case.created_by = v_uid) OR
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid));

  IF NOT v_is_authorized THEN
     RAISE EXCEPTION 'Access Denied: You do not have permission to view this case.';
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

  -- 4. Actualizaciones
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'created_at', cu.created_at,
    'image_url', cu.image_url,
    'images', COALESCE(cu.images, CASE WHEN cu.image_url IS NOT NULL THEN ARRAY[cu.image_url] ELSE ARRAY[]::TEXT[] END),
    'documents', COALESCE(cu.documents, '[]'::jsonb),
    'author_name', u.nombre || ' ' || u.apellido,
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'author_id', cu.author_id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.case_updates cu
  JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- 5. Interrogatorios
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'interrogation_date', i.interrogation_date,
    'subjects', i.subjects,
    'agents_present', i.agents_present,
    'transcription', i.transcription
  ) ORDER BY i.interrogation_date DESC, i.created_at DESC) INTO v_interrogations
  FROM public.interrogations i
  JOIN public.case_interrogations ci ON i.id = ci.interrogation_id
  WHERE ci.case_id = p_case_id;

  -- 6. Incidentes Vinculados
  SELECT json_agg(json_build_object(
    'id', inc.id,
    'title', inc.title,
    'incident_date', inc.incident_date,
    'location', inc.location,
    'summary', inc.summary
  ) ORDER BY inc.incident_date DESC, inc.created_at DESC) INTO v_incidents
  FROM public.incidents inc
  JOIN public.case_incidents cinc ON inc.id = cinc.incident_id
  WHERE cinc.case_id = p_case_id;

  -- 7. Salidas Vinculadas
  SELECT json_agg(json_build_object(
    'id', o.id,
    'title', o.title,
    'outing_date', o.outing_date,
    'description', o.description,
    'tag', o.tag
  ) ORDER BY o.outing_date DESC, o.created_at DESC) INTO v_outings
  FROM public.outings o
  JOIN public.case_outings co ON o.id = co.outing_id
  WHERE co.case_id = p_case_id;

  -- 8. Denuncias Vinculadas
  SELECT json_agg(json_build_object(
    'id', cmp.id,
    'denuncia_number', cmp.denuncia_number,
    'title', cmp.title,
    'victim_name', cmp.victim_name,
    'created_at', cmp.created_at
  ) ORDER BY cmp.created_at DESC) INTO v_complaints
  FROM public.scub_denuncias cmp
  JOIN public.case_complaints cc ON cmp.id = cc.complaint_id
  WHERE cc.case_id = p_case_id;

  -- 9. Bandas Vinculadas
  SELECT json_agg(json_build_object(
    'id', g.id,
    'name', g.name,
    'color', g.color,
    'territory', g.territory,
    'notes', g.notes,
    'danger_level', g.danger_level
  ) ORDER BY g.name ASC) INTO v_gangs
  FROM public.gangs g
  JOIN public.case_gangs cg ON g.id = cg.gang_id
  WHERE cg.case_id = p_case_id;

  -- 10. Balística: Coincidencias
  SELECT json_agg(json_build_object(
    'id', b.id,
    'code', b.code,
    'weapon_model', b.weapon_model,
    'serial_number', b.serial_number,
    'caliber', b.caliber,
    'weapon_status', b.weapon_status,
    'bullet_description', b.bullet_description,
    'found_at', b.found_at
  ) ORDER BY b.created_at DESC) INTO v_ballistics_coincidences
  FROM public.ballistics b
  JOIN public.case_ballistics cb ON b.id = cb.ballistic_id
  WHERE cb.case_id = p_case_id AND cb.relation_type = 'coincidence';

  -- 11. Balística: Armas
  SELECT json_agg(json_build_object(
    'id', b.id,
    'code', b.code,
    'weapon_model', b.weapon_model,
    'serial_number', b.serial_number,
    'caliber', b.caliber,
    'weapon_status', b.weapon_status,
    'found_at', b.found_at
  ) ORDER BY b.created_at DESC) INTO v_ballistics_weapons
  FROM public.ballistics b
  JOIN public.case_ballistics cb ON b.id = cb.ballistic_id
  WHERE cb.case_id = p_case_id AND cb.relation_type = 'weapon';

  -- 12. Balística: Casquillos
  SELECT json_agg(json_build_object(
    'id', b.id,
    'code', b.code,
    'caliber', b.caliber,
    'bullet_description', b.bullet_description,
    'found_at', b.found_at
  ) ORDER BY b.created_at DESC) INTO v_ballistics_bullets
  FROM public.ballistics b
  JOIN public.case_ballistics cb ON b.id = cb.ballistic_id
  WHERE cb.case_id = p_case_id AND cb.relation_type = 'bullet';

  RETURN json_build_object(
    'info', json_build_object(
      'id', v_case.id,
      'case_number', v_case.case_number,
      'title', v_case.title,
      'location', v_case.location,
      'occurred_at', v_case.occurred_at,
      'description', v_case.description,
      'status', v_case.status,
      'image_url', v_case.image_url,
      'documents', COALESCE(v_case.documents, '[]'::jsonb),
      'created_at', v_case.created_at,
      'created_by', v_case.created_by,
      'whiteboard_data', v_case.whiteboard_data
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

GRANT EXECUTE ON FUNCTION public.get_case_details(UUID) TO authenticated, service_role;
