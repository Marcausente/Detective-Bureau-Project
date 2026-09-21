-- ==============================================================================
-- GANG WEEKLY INCIDENT ACTIVITY ANALYSIS & HELPER RPCs
-- ==============================================================================

-- 1. Helper Function to calculate day-of-week incident statistics for a gang
CREATE OR REPLACE FUNCTION get_gang_weekly_incident_stats(p_gang_id UUID)
RETURNS TABLE (
    day_name TEXT,
    day_index INT,
    incident_count BIGINT,
    percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_incidents BIGINT;
BEGIN
    -- Get total incidents count for this gang
    SELECT COUNT(*) INTO v_total_incidents
    FROM incident_gangs ig
    WHERE ig.gang_id = p_gang_id;

    RETURN QUERY
    WITH days_series AS (
        SELECT 
            d.day_index,
            d.day_name,
            d.day_order
        FROM (VALUES 
            (1, 'Lunes', 1),
            (2, 'Martes', 2),
            (3, 'Miércoles', 3),
            (4, 'Jueves', 4),
            (5, 'Viernes', 5),
            (6, 'Sábado', 6),
            (0, 'Domingo', 7)
        ) AS d(day_index, day_name, day_order)
    ),
    gang_incidents_by_day AS (
        SELECT 
            EXTRACT(DOW FROM COALESCE(i.occurred_at, i.created_at))::INT AS dow,
            COUNT(*)::BIGINT AS cnt
        FROM incidents i
        JOIN incident_gangs ig ON ig.incident_id = i.id
        WHERE ig.gang_id = p_gang_id
        GROUP BY EXTRACT(DOW FROM COALESCE(i.occurred_at, i.created_at))::INT
    )
    SELECT 
        ds.day_name,
        ds.day_index,
        COALESCE(gbd.cnt, 0)::BIGINT AS incident_count,
        CASE 
            WHEN v_total_incidents > 0 THEN ROUND((COALESCE(gbd.cnt, 0)::NUMERIC / v_total_incidents::NUMERIC) * 100, 1)
            ELSE 0.0
        END AS percentage
    FROM days_series ds
    LEFT JOIN gang_incidents_by_day gbd ON ds.day_index = gbd.dow
    ORDER BY incident_count DESC, ds.day_order ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_gang_weekly_incident_stats(UUID) TO authenticated;
