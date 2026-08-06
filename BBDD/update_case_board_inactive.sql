-- Migration: Add is_inactive to case_board_nodes table and update get_case_board_data RPC

ALTER TABLE public.case_board_nodes ADD COLUMN IF NOT EXISTS is_inactive BOOLEAN DEFAULT false;

-- Update get_case_board_data function to return is_inactive for each node
CREATE OR REPLACE FUNCTION get_case_board_data(p_case_id UUID DEFAULT NULL, p_is_ia BOOLEAN DEFAULT false, p_gang_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    v_nodes JSON;
    v_links JSON;
BEGIN
    IF p_gang_id IS NOT NULL THEN
        SELECT COALESCE(json_agg(
            json_build_object(
                'id', n.id,
                'gang_id', n.gang_id,
                'title', n.title,
                'content', n.content,
                'category', n.category,
                'color', n.color,
                'image_url', n.image_url,
                'pos_x', n.pos_x,
                'pos_y', n.pos_y,
                'width', n.width,
                'linked_update_ids', COALESCE(n.linked_update_ids, '[]'::jsonb),
                'is_inactive', COALESCE(n.is_inactive, false),
                'created_at', n.created_at,
                'created_by', n.created_by
            ) ORDER BY n.created_at ASC
        ), '[]'::json) INTO v_nodes
        FROM public.case_board_nodes n
        WHERE n.gang_id = p_gang_id;

        SELECT COALESCE(json_agg(
            json_build_object(
                'id', l.id,
                'gang_id', l.gang_id,
                'source_id', l.source_id,
                'target_id', l.target_id,
                'label', l.label,
                'label_pos', COALESCE(l.label_pos, 0.5),
                'color', l.color,
                'style', l.style,
                'created_at', l.created_at
            ) ORDER BY l.created_at ASC
        ), '[]'::json) INTO v_links
        FROM public.case_board_links l
        WHERE l.gang_id = p_gang_id;
    ELSIF p_is_ia THEN
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
                'linked_update_ids', COALESCE(n.linked_update_ids, '[]'::jsonb),
                'is_inactive', COALESCE(n.is_inactive, false),
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
                'label_pos', COALESCE(l.label_pos, 0.5),
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
                'linked_update_ids', COALESCE(n.linked_update_ids, '[]'::jsonb),
                'is_inactive', COALESCE(n.is_inactive, false),
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
                'label_pos', COALESCE(l.label_pos, 0.5),
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
