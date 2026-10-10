-- AGENT ACTIVITY & CHRONOLOGICAL CONTRIBUTIONS
-- Documentation and helper RPC to query all agent contributions (incidents, patrol matrices, outings, documents)

CREATE OR REPLACE FUNCTION get_agent_activity_feed(p_target_user_id UUID)
RETURNS TABLE (
    item_id UUID,
    activity_type TEXT, -- 'incident', 'matrix', 'outing', 'document'
    title TEXT,
    date_timestamp TIMESTAMP WITH TIME ZONE,
    location_or_gang TEXT,
    summary TEXT,
    photo TEXT,
    images JSONB,
    people_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    -- 1. Incidents
    SELECT
        i.id AS item_id,
        'incident'::TEXT AS activity_type,
        i.title,
        COALESCE(i.occurred_at, i.created_at) AS date_timestamp,
        i.location AS location_or_gang,
        i.description AS summary,
        NULL::TEXT AS photo,
        i.images,
        NULL::INTEGER AS people_count
    FROM public.incidents i
    WHERE i.author_id = p_target_user_id

    UNION ALL

    -- 2. Gang Unit Patrol Logs (Matrices)
    SELECT
        pl.id AS item_id,
        'matrix'::TEXT AS activity_type,
        ('Patrullaje / Matriz - ' || COALESCE(g.name, 'Banda'))::TEXT AS title,
        COALESCE(pl.patrol_time, pl.created_at) AS date_timestamp,
        g.name AS location_or_gang,
        pl.notes AS summary,
        pl.photo,
        NULL::JSONB AS images,
        pl.people_count
    FROM public.gang_patrol_logs pl
    LEFT JOIN public.gangs g ON pl.gang_id = g.id
    WHERE pl.created_by = p_target_user_id

    UNION ALL

    -- 3. Outings (Vigilancias)
    SELECT
        o.id AS item_id,
        'outing'::TEXT AS activity_type,
        COALESCE(o.title, o.reason) AS title,
        COALESCE(o.occurred_at, o.created_at) AS date_timestamp,
        (SELECT g.name FROM public.outing_gangs og JOIN public.gangs g ON og.gang_id = g.id WHERE og.outing_id = o.id LIMIT 1) AS location_or_gang,
        COALESCE(o.info_obtained, o.reason) AS summary,
        NULL::TEXT AS photo,
        o.images,
        NULL::INTEGER AS people_count
    FROM public.outings o
    WHERE o.created_by = p_target_user_id

    ORDER BY date_timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_agent_activity_feed(UUID) TO authenticated;
