-- Function to update gang name and color (VIP only)
DROP FUNCTION IF EXISTS public.update_gang_name(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.update_gang_name(
    p_gang_id UUID,
    p_name TEXT,
    p_color TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT auth_is_gang_vip() THEN 
        RAISE EXCEPTION 'Access Denied: High Command Only'; 
    END IF;
    
    UPDATE public.gangs 
    SET name = p_name,
        color = p_color
    WHERE id = p_gang_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
