
-- Enable Linking for Visible Interrogations
-- Creates a secure RPC to fetch unlinked interrogations respecting the visibility rules.

DROP FUNCTION IF EXISTS get_available_interrogations_to_link();

CREATE OR REPLACE FUNCTION get_available_interrogations_to_link()
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  subjects TEXT
) AS $$
DECLARE
  v_uid UUID;
  v_user_fullname TEXT;
  v_is_vip BOOLEAN;
BEGIN
  v_uid := auth.uid();
  
  -- Get user name safely
  SELECT (nombre || ' ' || apellido) INTO v_user_fullname FROM public.users WHERE id = v_uid;
  
  -- Check VIP Status (Same logic as get_interrogations)
  SELECT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = v_uid 
    AND (
       TRIM(u.rol::text) IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective') 
       OR u.rol::text ILIKE '%Detective%'
       OR u.rol::text ILIKE '%Admin%'
    )
  ) INTO v_is_vip;

  IF v_is_vip THEN
      -- VIP: See ALL unlinked interrogations
      RETURN QUERY
      SELECT i.id, i.title, i.created_at, i.subjects
      FROM public.interrogations i
      WHERE i.case_id IS NULL
      ORDER BY i.created_at DESC;
  ELSE
      -- REGULAR: See Own + Tagged (if unlinked)
      RETURN QUERY
      SELECT i.id, i.title, i.created_at, i.subjects
      FROM public.interrogations i
      WHERE i.case_id IS NULL
      AND (
          (i.author_id = v_uid)
          OR
          (i.agents_present ILIKE '%' || COALESCE(v_user_fullname, '___NOMATCH___') || '%')
      )
      ORDER BY i.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
