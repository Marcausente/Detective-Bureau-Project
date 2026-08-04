-- CASE BOARD / PIZARRA SYSTEM (Nodes and Links)

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.case_board_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    ia_case_id UUID REFERENCES public.ia_cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT NOT NULL DEFAULT 'note', -- 'suspect', 'evidence', 'location', 'vehicle', 'witness', 'victim', 'note'
    color TEXT NOT NULL DEFAULT 'red', -- 'red', 'yellow', 'blue', 'green', 'purple', 'dark'
    image_url TEXT,
    pos_x NUMERIC NOT NULL DEFAULT 100,
    pos_y NUMERIC NOT NULL DEFAULT 100,
    width INT DEFAULT 240,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.case_board_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    ia_case_id UUID REFERENCES public.ia_cases(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.case_board_nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.case_board_nodes(id) ON DELETE CASCADE,
    label TEXT,
    color TEXT NOT NULL DEFAULT '#ef4444',
    style TEXT DEFAULT 'solid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.case_board_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_board_links ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
DROP POLICY IF EXISTS "Auth Read Board Nodes" ON public.case_board_nodes;
CREATE POLICY "Auth Read Board Nodes" ON public.case_board_nodes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth Write Board Nodes" ON public.case_board_nodes;
CREATE POLICY "Auth Write Board Nodes" ON public.case_board_nodes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth Update Board Nodes" ON public.case_board_nodes;
CREATE POLICY "Auth Update Board Nodes" ON public.case_board_nodes FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth Delete Board Nodes" ON public.case_board_nodes;
CREATE POLICY "Auth Delete Board Nodes" ON public.case_board_nodes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth Read Board Links" ON public.case_board_links;
CREATE POLICY "Auth Read Board Links" ON public.case_board_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth Write Board Links" ON public.case_board_links;
CREATE POLICY "Auth Write Board Links" ON public.case_board_links FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth Update Board Links" ON public.case_board_links;
CREATE POLICY "Auth Update Board Links" ON public.case_board_links FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth Delete Board Links" ON public.case_board_links;
CREATE POLICY "Auth Delete Board Links" ON public.case_board_links FOR DELETE TO authenticated USING (true);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_case_board_nodes_case_id ON public.case_board_nodes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_board_nodes_ia_case_id ON public.case_board_nodes(ia_case_id);
CREATE INDEX IF NOT EXISTS idx_case_board_links_case_id ON public.case_board_links(case_id);
CREATE INDEX IF NOT EXISTS idx_case_board_links_ia_case_id ON public.case_board_links(ia_case_id);

-- RPC to get board data cleanly
CREATE OR REPLACE FUNCTION get_case_board_data(p_case_id UUID, p_is_ia BOOLEAN DEFAULT false)
RETURNS JSON AS $$
DECLARE
    v_nodes JSON;
    v_links JSON;
BEGIN
    IF p_is_ia THEN
        SELECT COALESCE(json_agg(
            json_build_object(
                'id', n.id,
                'ia_case_id', n.ia_case_id,
                'title', n.title,
                'content', n.content,
                'category', n.category,
                'color', n.color,
                'image_url', n.image_url,
                'pos_x', n.pos_x,
                'pos_y', n.pos_y,
                'width', n.width,
                'created_at', n.created_at,
                'created_by', n.created_by
            ) ORDER BY n.created_at ASC
        ), '[]'::json) INTO v_nodes
        FROM public.case_board_nodes n
        WHERE n.ia_case_id = p_case_id;

        SELECT COALESCE(json_agg(
            json_build_object(
                'id', l.id,
                'ia_case_id', l.ia_case_id,
                'source_id', l.source_id,
                'target_id', l.target_id,
                'label', l.label,
                'color', l.color,
                'style', l.style,
                'created_at', l.created_at
            ) ORDER BY l.created_at ASC
        ), '[]'::json) INTO v_links
        FROM public.case_board_links l
        WHERE l.ia_case_id = p_case_id;
    ELSE
        SELECT COALESCE(json_agg(
            json_build_object(
                'id', n.id,
                'case_id', n.case_id,
                'title', n.title,
                'content', n.content,
                'category', n.category,
                'color', n.color,
                'image_url', n.image_url,
                'pos_x', n.pos_x,
                'pos_y', n.pos_y,
                'width', n.width,
                'created_at', n.created_at,
                'created_by', n.created_by
            ) ORDER BY n.created_at ASC
        ), '[]'::json) INTO v_nodes
        FROM public.case_board_nodes n
        WHERE n.case_id = p_case_id;

        SELECT COALESCE(json_agg(
            json_build_object(
                'id', l.id,
                'case_id', l.case_id,
                'source_id', l.source_id,
                'target_id', l.target_id,
                'label', l.label,
                'color', l.color,
                'style', l.style,
                'created_at', l.created_at
            ) ORDER BY l.created_at ASC
        ), '[]'::json) INTO v_links
        FROM public.case_board_links l
        WHERE l.case_id = p_case_id;
    END IF;

    RETURN json_build_object(
        'nodes', v_nodes,
        'links', v_links
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
