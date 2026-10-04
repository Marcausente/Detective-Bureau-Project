-- BBDD/add_case_documents_migration.sql
-- Migration to allow uploading and attaching documents/PDFs to Cases and Case Updates (Novedades)

-- 1. Ensure documents column exists in public.cases and public.case_updates
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.case_updates 
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;

-- 2. Drop old overloads to prevent ambiguous signature conflicts
DROP FUNCTION IF EXISTS public.create_new_case(text, text, timestamp with time zone, text, uuid[]);
DROP FUNCTION IF EXISTS public.create_new_case(text, text, timestamp with time zone, text, uuid[], text);
DROP FUNCTION IF EXISTS public.create_new_case(text, text, timestamp with time zone, text, uuid[], text, jsonb);

DROP FUNCTION IF EXISTS public.add_case_update(uuid, text);
DROP FUNCTION IF EXISTS public.add_case_update(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.add_case_update(uuid, text, jsonb, jsonb);

DROP FUNCTION IF EXISTS public.update_case_update_content(uuid, text);
DROP FUNCTION IF EXISTS public.update_case_update_content(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.update_case_update_content(uuid, text, jsonb, jsonb);

DROP FUNCTION IF EXISTS public.update_case_details(uuid, text, text, timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.update_case_details(uuid, text, text, timestamp with time zone, text, jsonb);

-- 3. Re-create create_new_case with documents support
CREATE OR REPLACE FUNCTION public.create_new_case(
  p_title TEXT,
  p_location TEXT,
  p_occurred_at TIMESTAMP WITH TIME ZONE,
  p_description TEXT,
  p_assigned_ids UUID[] DEFAULT '{}',
  p_image TEXT DEFAULT NULL,
  p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_new_case_id UUID;
  v_uid UUID;
BEGIN
  -- Insert Case
  INSERT INTO public.cases (
    title, 
    location, 
    occurred_at, 
    description, 
    created_by, 
    initial_image_url, 
    documents
  )
  VALUES (
    p_title, 
    p_location, 
    p_occurred_at, 
    p_description, 
    auth.uid(), 
    p_image, 
    COALESCE(p_documents, '[]'::jsonb)
  )
  RETURNING id INTO v_new_case_id;

  -- Insert Assignments
  IF p_assigned_ids IS NOT NULL AND array_length(p_assigned_ids, 1) > 0 THEN
    FOREACH v_uid IN ARRAY p_assigned_ids
    LOOP
      INSERT INTO public.case_assignments (case_id, user_id, role) 
      VALUES (v_new_case_id, v_uid, 'Investigador')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_new_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_new_case(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, UUID[], TEXT, JSONB) TO authenticated, service_role;

-- 4. Re-create add_case_update with documents support
CREATE OR REPLACE FUNCTION public.add_case_update(
  p_case_id UUID,
  p_content TEXT,
  p_images JSONB DEFAULT '[]'::jsonb,
  p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  -- Validation: Must have either content, images, or documents
  IF (p_content IS NULL OR TRIM(p_content) = '') 
     AND (COALESCE(jsonb_array_length(p_images), 0) = 0) 
     AND (COALESCE(jsonb_array_length(p_documents), 0) = 0) THEN
      RAISE EXCEPTION 'Update must contain text, images, or documents.';
  END IF;

  INSERT INTO public.case_updates (
    case_id, 
    author_id, 
    content, 
    images, 
    documents, 
    created_at
  )
  VALUES (
    p_case_id, 
    auth.uid(), 
    p_content, 
    COALESCE(p_images, '[]'::jsonb), 
    COALESCE(p_documents, '[]'::jsonb), 
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_case_update(UUID, TEXT, JSONB, JSONB) TO authenticated, service_role;

-- 5. Re-create update_case_update_content with documents support
CREATE OR REPLACE FUNCTION public.update_case_update_content(
  p_update_id UUID,
  p_content TEXT,
  p_images JSONB DEFAULT '[]'::jsonb,
  p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.case_updates
  SET 
    content = p_content,
    images = COALESCE(p_images, '[]'::jsonb),
    documents = COALESCE(p_documents, '[]'::jsonb)
  WHERE id = p_update_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_case_update_content(UUID, TEXT, JSONB, JSONB) TO authenticated, service_role;

-- 6. Re-create update_case_details with documents support
CREATE OR REPLACE FUNCTION public.update_case_details(
  p_case_id UUID,
  p_title TEXT,
  p_location TEXT,
  p_occurred_at TIMESTAMP WITH TIME ZONE,
  p_description TEXT,
  p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID;
  v_user_role TEXT;
  v_creator_id UUID;
  v_is_admin_or_coord BOOLEAN;
  v_is_encargado BOOLEAN;
BEGIN
  v_uid := auth.uid();

  -- 1. Get User Role safely
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;
  
  -- Explicit check for Ayudante
  IF v_user_role = 'Ayudante' THEN
      RAISE EXCEPTION 'Access Denied: Ayudantes cannot edit case details.';
  END IF;

  -- 2. Get Case Creator
  SELECT created_by INTO v_creator_id FROM public.cases WHERE id = p_case_id;

  IF v_creator_id IS NULL THEN
      RAISE EXCEPTION 'Case not found';
  END IF;

  -- 3. Check Permissions
  v_is_admin_or_coord := (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado'));

  -- Check if user is assigned as 'Encargado'
  SELECT EXISTS (
    SELECT 1 
    FROM public.case_assignments 
    WHERE case_id = p_case_id AND user_id = v_uid AND role = 'Encargado'
  ) INTO v_is_encargado;

  -- Allow if Admin/Coord OR if Current User is the Creator OR if they are assigned as 'Encargado'
  IF (v_is_admin_or_coord) OR (v_creator_id = v_uid) OR (v_is_encargado) THEN
      UPDATE public.cases
      SET 
        title = p_title,
        location = p_location,
        occurred_at = p_occurred_at,
        description = p_description,
        documents = COALESCE(p_documents, '[]'::jsonb)
      WHERE id = p_case_id;
  ELSE
      RAISE EXCEPTION 'Access Denied: You do not have permission to edit this case.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_case_details(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, JSONB) TO authenticated, service_role;

-- 7. Update get_case_details to return documents in info and updates
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
  v_is_authorized BOOLEAN;
  v_user_role TEXT;
BEGIN
  v_uid := auth.uid();

  -- 1. Check if Case Exists
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN
     RAISE EXCEPTION 'Case not found';
  END IF;

  -- 2. Authorization Check
  SELECT TRIM(rol::text) INTO v_user_role FROM public.users WHERE id = v_uid;

  v_is_authorized := 
      (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective')) OR
      (v_user_role ILIKE '%Detective%') OR
      (v_case.created_by = v_uid) OR
      (EXISTS (SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = p_case_id AND ca.user_id = v_uid));

  IF NOT v_is_authorized THEN
     RAISE EXCEPTION 'Access Denied: You do not have permission to view this case.';
  END IF;

  -- 3. Fetch Assignments
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

  -- 4. Fetch Updates (with documents)
  SELECT json_agg(json_build_object(
    'id', cu.id,
    'content', cu.content,
    'image', cu.image_url,
    'images', COALESCE(cu.images, '[]'::jsonb),
    'documents', COALESCE(cu.documents, '[]'::jsonb),
    'created_at', cu.created_at,
    'author_name', COALESCE(u.nombre || ' ' || u.apellido, 'Usuario Eliminado'),
    'author_rank', u.rango,
    'author_avatar', u.profile_image,
    'user_id', cu.author_id
  ) ORDER BY cu.created_at DESC) INTO v_updates
  FROM public.case_updates cu
  LEFT JOIN public.users u ON cu.author_id = u.id
  WHERE cu.case_id = p_case_id;

  -- 5. Fetch Linked Interrogations
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'created_at', i.created_at,
    'subjects', i.subjects
  ) ORDER BY i.created_at DESC) INTO v_interrogations
  FROM public.interrogations i
  WHERE i.case_id = p_case_id;

  -- 6. Fetch Linked Incidents
  SELECT json_agg(json_build_object(
    'id', i.id,
    'title', i.title,
    'occurred_at', i.occurred_at,
    'location', i.location
  ) ORDER BY i.occurred_at DESC) INTO v_incidents
  FROM public.incidents i
  JOIN public.case_incidents ci ON ci.incident_id = i.id
  WHERE ci.case_id = p_case_id;

  -- 7. Fetch Linked Outings
  SELECT json_agg(json_build_object(
    'id', o.id,
    'title', o.title,
    'occurred_at', o.occurred_at
  ) ORDER BY o.occurred_at DESC) INTO v_outings
  FROM public.outings o
  JOIN public.case_outings co ON co.outing_id = o.id
  WHERE co.case_id = p_case_id;

  -- 8. Fetch Linked Complaints (Denuncias)
  SELECT json_agg(json_build_object(
    'id', d.id,
    'titulo', d.titulo,
    'created_at', d.created_at,
    'status', d.status
  ) ORDER BY d.created_at DESC) INTO v_complaints
  FROM public.denuncias d
  WHERE d.case_id = p_case_id;

  -- 9. Fetch Linked Criminal Groups (Gangs)
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

  -- 10. Fetch Linked Ballistics Coincidences
  SELECT json_agg(json_build_object(
    'id', m.id,
    'weapon_id', w.id,
    'serial_number', w.numero_serie,
    'numero_serie', w.numero_serie,
    'weapon_model', w.modelo,
    'modelo', w.modelo,
    'matched_at', m.created_at,
    'match_type', m.match_type,
    'details', m.detalles,
    'status', COALESCE(m.status, 'Con caso')
  ) ORDER BY m.created_at DESC) INTO v_ballistics_coincidences
  FROM public.ballistics_matches m
  JOIN public.ballistics_weapons w ON m.weapon_id = w.id
  WHERE m.case_id = p_case_id;

  -- 11. Fetch Linked Ballistics Weapons
  SELECT json_agg(json_build_object(
    'id', w.id,
    'serial_number', w.numero_serie,
    'numero_serie', w.numero_serie,
    'model', w.modelo,
    'modelo', w.modelo,
    'status', w.estado,
    'created_at', w.created_at
  ) ORDER BY w.created_at DESC) INTO v_ballistics_weapons
  FROM public.ballistics_weapons w
  WHERE w.case_id = p_case_id;

  -- 12. Fetch Linked Ballistics Bullets
  SELECT json_agg(json_build_object(
    'id', b.id,
    'bullet_type', b.tipo_municion,
    'tipo_municion', b.tipo_municion,
    'caliber', b.calibre,
    'calibre', b.calibre,
    'location', b.ubicacion,
    'ubicacion', b.ubicacion,
    'description', b.descripcion,
    'descripcion', b.descripcion,
    'created_at', b.created_at
  ) ORDER BY b.created_at DESC) INTO v_ballistics_bullets
  FROM public.ballistics_bullets b
  WHERE b.case_id = p_case_id;

  -- Final Response Object
  RETURN json_build_object(
    'info', json_build_object(
      'id', v_case.id,
      'case_number', v_case.case_number,
      'title', v_case.title,
      'status', v_case.status,
      'location', v_case.location,
      'occurred_at', v_case.occurred_at,
      'description', v_case.description,
      'created_at', v_case.created_at,
      'created_by', v_case.created_by,
      'is_pinned', COALESCE(v_case.is_pinned, false),
      'initial_image_url', v_case.initial_image_url,
      'documents', COALESCE(v_case.documents, '[]'::jsonb)
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
