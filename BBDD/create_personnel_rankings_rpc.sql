-- CREATE RPC FUNCTION TO GET PERSONNEL LEADERBOARD RANKINGS
-- Calculates top 10 personnel across 5 categories: Closed Cases, Uploaded Incidents, Outings, Interrogations Participation, and Gang Unit Matrices.

CREATE OR REPLACE FUNCTION get_personnel_rankings()
RETURNS JSON AS $$
DECLARE
    v_closed_cases JSON;
    v_incidents JSON;
    v_outings JSON;
    v_interrogations JSON;
    v_matrix JSON;
BEGIN
    -- 1. Closed Cases Leaderboard
    SELECT COALESCE(json_agg(r), '[]'::json) INTO v_closed_cases FROM (
        SELECT 
            u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image,
            COUNT(DISTINCT c.id) as count
        FROM public.users u
        JOIN (
            SELECT case_id, user_id FROM public.case_assignments
            UNION
            SELECT id as case_id, created_by as user_id FROM public.cases WHERE created_by IS NOT NULL
        ) uc ON u.id = uc.user_id
        JOIN public.cases c ON uc.case_id = c.id
        WHERE c.status = 'Closed'
        GROUP BY u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image
        HAVING COUNT(DISTINCT c.id) > 0
        ORDER BY count DESC, u.nombre ASC
        LIMIT 10
    ) r;

    -- 2. Incidents Leaderboard
    SELECT COALESCE(json_agg(r), '[]'::json) INTO v_incidents FROM (
        SELECT 
            u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image,
            COUNT(inc.id) as count
        FROM public.users u
        JOIN public.incidents inc ON u.id = inc.author_id
        GROUP BY u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image
        HAVING COUNT(inc.id) > 0
        ORDER BY count DESC, u.nombre ASC
        LIMIT 10
    ) r;

    -- 3. Outings Leaderboard
    SELECT COALESCE(json_agg(r), '[]'::json) INTO v_outings FROM (
        SELECT 
            u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image,
            COUNT(o.id) as count
        FROM public.users u
        JOIN public.outings o ON u.id = o.created_by
        GROUP BY u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image
        HAVING COUNT(o.id) > 0
        ORDER BY count DESC, u.nombre ASC
        LIMIT 10
    ) r;

    -- 4. Interrogations Leaderboard
    SELECT COALESCE(json_agg(r), '[]'::json) INTO v_interrogations FROM (
        SELECT 
            u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image,
            COUNT(DISTINCT i.id) as count
        FROM public.users u
        JOIN public.interrogations i ON (
            i.author_id = u.id OR 
            (i.agents_present IS NOT NULL AND i.agents_present ILIKE '%' || u.apellido || '%')
        )
        GROUP BY u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image
        HAVING COUNT(DISTINCT i.id) > 0
        ORDER BY count DESC, u.nombre ASC
        LIMIT 10
    ) r;

    -- 5. Matrix / Patrol Logs Leaderboard
    SELECT COALESCE(json_agg(r), '[]'::json) INTO v_matrix FROM (
        SELECT 
            u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image,
            COUNT(gpl.id) as count
        FROM public.users u
        JOIN public.gang_patrol_logs gpl ON u.id = gpl.created_by
        GROUP BY u.id, u.nombre, u.apellido, u.rango, u.no_placa, u.profile_image
        HAVING COUNT(gpl.id) > 0
        ORDER BY count DESC, u.nombre ASC
        LIMIT 10
    ) r;

    RETURN json_build_object(
        'closed_cases', v_closed_cases,
        'incidents', v_incidents,
        'outings', v_outings,
        'interrogations', v_interrogations,
        'matrix', v_matrix
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION get_personnel_rankings() TO authenticated;
