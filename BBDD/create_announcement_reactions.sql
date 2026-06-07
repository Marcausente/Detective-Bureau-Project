-- 1. Create Announcement Reactions Table
CREATE TABLE IF NOT EXISTS public.announcement_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON public.announcement_reactions;
CREATE POLICY "Allow select for all authenticated users" 
    ON public.announcement_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for own reactions" ON public.announcement_reactions;
CREATE POLICY "Allow insert for own reactions" 
    ON public.announcement_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete for own reactions" ON public.announcement_reactions;
CREATE POLICY "Allow delete for own reactions" 
    ON public.announcement_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 2. Create RPC to toggle announcement reaction
CREATE OR REPLACE FUNCTION toggle_announcement_reaction(p_announcement_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    SELECT EXISTS (
        SELECT 1 FROM announcement_reactions 
        WHERE announcement_id = p_announcement_id AND user_id = v_user_id
    ) INTO v_exists;
    
    IF v_exists THEN
        DELETE FROM announcement_reactions 
        WHERE announcement_id = p_announcement_id AND user_id = v_user_id;
        RETURN FALSE; -- Reaction removed
    ELSE
        INSERT INTO announcement_reactions (announcement_id, user_id)
        VALUES (p_announcement_id, v_user_id);
        RETURN TRUE; -- Reaction added
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Drop and Recreate get_announcements RPC to support reactions info
DROP FUNCTION IF EXISTS get_announcements();

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
  reactions JSON
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
    ) as reactions
  FROM public.announcements a
  LEFT JOIN public.users u ON a.author_id = u.id
  ORDER BY a.pinned DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Grant Permissions
GRANT EXECUTE ON FUNCTION toggle_announcement_reaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_announcements TO authenticated;
