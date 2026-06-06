-- Drop existing function signatures to avoid parameter list conflicts
DROP FUNCTION IF EXISTS get_upcoming_events(UUID);
DROP FUNCTION IF EXISTS get_all_month_events(UUID, INT, INT);

-- Recreate get_upcoming_events with the participants JSON column
CREATE OR REPLACE FUNCTION get_upcoming_events(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    participant_count BIGINT,
    is_participating BOOLEAN,
    author_name TEXT,
    author_rank TEXT,
    author_image TEXT,
    user_status TEXT,
    participants JSON
) AS $$
BEGIN
    RETURN QUERY
    
    -- 1. Standard General Events
    SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.created_by,
        e.created_at,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count,
        EXISTS (SELECT 1 FROM event_participants ep WHERE ep.event_id = e.id AND ep.user_id = p_user_id) AS is_participating,
        u.nombre || ' ' || u.apellido AS author_name,
        u.rango::text AS author_rank,
        u.profile_image AS author_image,
        NULL::TEXT AS user_status, -- Normal events don't have attendance status
        (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', u_p.id,
                    'nombre', u_p.nombre,
                    'apellido', u_p.apellido,
                    'rango', u_p.rango::text,
                    'profile_image', u_p.profile_image,
                    'status', 'REGISTERED'
                ) ORDER BY u_p.rango DESC, u_p.apellido ASC, u_p.nombre ASC
            ), '[]'::json)
            FROM event_participants ep
            JOIN users u_p ON ep.user_id = u_p.id
            WHERE ep.event_id = e.id
        ) AS participants
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.event_date >= CURRENT_DATE
    
    UNION ALL
    
    -- 2. DTP Practice Events
    SELECT 
        de.id,
        dp.title AS title,
        COALESCE(dp.description, '') || CHR(10) || CHR(10) || 'Lugar/Notas: ' || COALESCE(de.notes, 'N/A') AS description,
        de.event_date,
        de.organizer_id AS created_by,
        de.created_at,
        (SELECT COUNT(*) FROM dtp_event_attendees dpea WHERE dpea.event_id = de.id) AS participant_count,
        EXISTS (SELECT 1 FROM dtp_event_attendees dpea WHERE dpea.event_id = de.id AND dpea.user_id = p_user_id) AS is_participating,
        u.nombre || ' ' || u.apellido AS author_name,
        u.rango::text AS author_rank,
        u.profile_image AS author_image,
        (SELECT status FROM dtp_event_attendees dpea WHERE dpea.event_id = de.id AND dpea.user_id = p_user_id LIMIT 1) AS user_status,
        (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', u_p.id,
                    'nombre', u_p.nombre,
                    'apellido', u_p.apellido,
                    'rango', u_p.rango::text,
                    'profile_image', u_p.profile_image,
                    'status', dpea.status
                ) ORDER BY u_p.rango DESC, u_p.apellido ASC, u_p.nombre ASC
            ), '[]'::json)
            FROM dtp_event_attendees dpea
            JOIN users u_p ON dpea.user_id = u_p.id
            WHERE dpea.event_id = de.id
        ) AS participants
    FROM dtp_events de
    JOIN dtp_practices dp ON de.practice_id = dp.id
    LEFT JOIN users u ON de.organizer_id = u.id
    WHERE de.event_date >= CURRENT_DATE 
      AND de.status != 'CANCELLED'
      
    ORDER BY event_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Recreate get_all_month_events with the participants JSON column
CREATE OR REPLACE FUNCTION get_all_month_events(p_user_id UUID, p_year INT, p_month INT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    participant_count BIGINT,
    is_participating BOOLEAN,
    author_name TEXT,
    author_rank TEXT,
    author_image TEXT,
    user_status TEXT,
    participants JSON
) AS $$
BEGIN
    RETURN QUERY
    
    -- 1. Standard General Events
    SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.created_by,
        e.created_at,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count,
        EXISTS (SELECT 1 FROM event_participants ep WHERE ep.event_id = e.id AND ep.user_id = p_user_id) AS is_participating,
        u.nombre || ' ' || u.apellido AS author_name,
        u.rango::text AS author_rank,
        u.profile_image AS author_image,
        NULL::TEXT AS user_status,
        (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', u_p.id,
                    'nombre', u_p.nombre,
                    'apellido', u_p.apellido,
                    'rango', u_p.rango::text,
                    'profile_image', u_p.profile_image,
                    'status', 'REGISTERED'
                ) ORDER BY u_p.rango DESC, u_p.apellido ASC, u_p.nombre ASC
            ), '[]'::json)
            FROM event_participants ep
            JOIN users u_p ON ep.user_id = u_p.id
            WHERE ep.event_id = e.id
        ) AS participants
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE EXTRACT(YEAR FROM e.event_date) = p_year 
      AND EXTRACT(MONTH FROM e.event_date) = p_month
      
    UNION ALL
    
    -- 2. DTP Practice Events
    SELECT 
        de.id,
        dp.title AS title,
        COALESCE(dp.description, '') || CHR(10) || CHR(10) || 'Lugar/Notas: ' || COALESCE(de.notes, 'N/A') AS description,
        de.event_date,
        de.organizer_id AS created_by,
        de.created_at,
        (SELECT COUNT(*) FROM dtp_event_attendees dpea WHERE dpea.event_id = de.id) AS participant_count,
        EXISTS (SELECT 1 FROM dtp_event_attendees dpea WHERE dpea.event_id = de.id AND dpea.user_id = p_user_id) AS is_participating,
        u.nombre || ' ' || u.apellido AS author_name,
        u.rango::text AS author_rank,
        u.profile_image AS author_image,
        (SELECT status FROM dtp_event_attendees dpea WHERE dpea.event_id = de.id AND dpea.user_id = p_user_id LIMIT 1) AS user_status,
        (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'user_id', u_p.id,
                    'nombre', u_p.nombre,
                    'apellido', u_p.apellido,
                    'rango', u_p.rango::text,
                    'profile_image', u_p.profile_image,
                    'status', dpea.status
                ) ORDER BY u_p.rango DESC, u_p.apellido ASC, u_p.nombre ASC
            ), '[]'::json)
            FROM dtp_event_attendees dpea
            JOIN users u_p ON dpea.user_id = u_p.id
            WHERE dpea.event_id = de.id
        ) AS participants
    FROM dtp_events de
    JOIN dtp_practices dp ON de.practice_id = dp.id
    LEFT JOIN users u ON de.organizer_id = u.id
    WHERE EXTRACT(YEAR FROM de.event_date) = p_year 
      AND EXTRACT(MONTH FROM de.event_date) = p_month
      AND de.status != 'CANCELLED'
      
    ORDER BY event_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
