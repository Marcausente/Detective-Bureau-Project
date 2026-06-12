-- ENHANCE ANNOUNCEMENTS SYSTEM: MULTI-IMAGE SUPPORT

-- 1. Schema Migration: Add 'images' JSONB column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='images') THEN
        ALTER TABLE public.announcements ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
    END IF;
END
$$;

-- 2. Update RPC: get_announcements
DROP FUNCTION IF EXISTS public.get_announcements();
CREATE OR REPLACE FUNCTION get_announcements()
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  pinned BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  author_name TEXT,
  author_image TEXT,
  author_rank app_rank,
  cur_user_can_delete BOOLEAN,
  has_reacted BOOLEAN,
  reaction_count BIGINT,
  reactions JSON,
  images JSONB
) AS $$
DECLARE
  v_viewer_id UUID;
  v_viewer_role app_role;
BEGIN
  v_viewer_id := auth.uid();
  
  -- Get Viewer Role safely
  SELECT u.rol INTO v_viewer_role FROM public.users u WHERE u.id = v_viewer_id;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.content,
    a.pinned,
    a.created_at,
    (u.nombre || ' ' || u.apellido) as author_name,
    u.profile_image as author_image,
    u.rango as author_rank,
    (a.author_id = v_viewer_id OR v_viewer_role IN ('Administrador', 'Comisionado', 'Coordinador')) as cur_user_can_delete,
    EXISTS (SELECT 1 FROM announcement_reactions ar WHERE ar.announcement_id = a.id AND ar.user_id = v_viewer_id) as has_reacted,
    (SELECT COUNT(*) FROM announcement_reactions ar WHERE ar.announcement_id = a.id) as reaction_count,
    (
        SELECT COALESCE(json_agg(
            json_build_object(
                'user_id', u_r.id,
                'nombre', u_r.nombre,
                'apellido', u_r.apellido,
                'rango', u_r.rango::text,
                'profile_image', u_r.profile_image
            ) ORDER BY u_r.rango DESC, u_r.apellido ASC, u_r.nombre ASC
        ), '[]'::json)
        FROM announcement_reactions ar
        JOIN users u_r ON ar.user_id = u_r.id
        WHERE ar.announcement_id = a.id
    ) as reactions,
    a.images
  FROM public.announcements a
  LEFT JOIN public.users u ON a.author_id = u.id
  ORDER BY a.pinned DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update RPC: create_announcement
DROP FUNCTION IF EXISTS public.create_announcement(TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION create_announcement(
  p_title TEXT,
  p_content TEXT,
  p_pinned BOOLEAN DEFAULT FALSE,
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_user_role app_role;
BEGIN
  -- Check Permissions
  SELECT u.rol INTO v_user_role FROM public.users u WHERE u.id = auth.uid();
  
  IF v_user_role NOT IN ('Detective', 'Coordinador', 'Comisionado', 'Administrador') THEN
    RAISE EXCEPTION 'Access Denied: You do not have permission to post announcements.';
  END IF;

  INSERT INTO public.announcements (author_id, title, content, pinned, images)
  VALUES (auth.uid(), p_title, p_content, p_pinned, p_images);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update RPC: update_announcement
DROP FUNCTION IF EXISTS public.update_announcement(UUID, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION update_announcement(
  p_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_pinned BOOLEAN,
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_author_id UUID;
  v_user_role app_role;
BEGIN
  SELECT a.author_id INTO v_author_id FROM public.announcements a WHERE a.id = p_id;
  SELECT u.rol INTO v_user_role FROM public.users u WHERE u.id = auth.uid();

  -- Verify existence
  IF v_author_id IS NULL THEN
     RAISE EXCEPTION 'Announcement not found';
  END IF;

  -- Logic: Allow edit if Author OR High Command
  IF auth.uid() = v_author_id OR v_user_role IN ('Administrador', 'Comisionado', 'Coordinador') THEN
    UPDATE public.announcements
    SET title = p_title,
        content = p_content,
        images = p_images
    WHERE id = p_id;

    -- Only allow updating Pinned if High Command
    IF v_user_role IN ('Administrador', 'Comisionado', 'Coordinador') THEN
        UPDATE public.announcements SET pinned = p_pinned WHERE id = p_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Access Denied: You cannot edit this announcement.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
