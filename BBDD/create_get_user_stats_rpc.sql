-- CREATE RPC FUNCTION TO GET USER PROFILE ACTIVITY STATS
-- Returns total incident reports uploaded, gang unit matrices submitted, and outings submitted by a specific user.

CREATE OR REPLACE FUNCTION get_user_stats(p_target_user_id UUID)
RETURNS TABLE (
    incidents_count BIGINT,
    matrix_count BIGINT,
    outings_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.incidents WHERE author_id = p_target_user_id)::BIGINT AS incidents_count,
        (SELECT COUNT(*) FROM public.gang_patrol_logs WHERE created_by = p_target_user_id)::BIGINT AS matrix_count,
        (SELECT COUNT(*) FROM public.outings WHERE created_by = p_target_user_id)::BIGINT AS outings_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;
