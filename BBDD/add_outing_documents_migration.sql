-- add_outing_documents_migration.sql
-- Migration to allow uploading and attaching documents/PDFs to Outings (Vigilancias)

-- 1. Add documents column to public.outings if not exists
ALTER TABLE public.outings 
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;

-- 2. Drop old overloads to prevent PostgreSQL ambiguity
DROP FUNCTION IF EXISTS public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[]);
DROP FUNCTION IF EXISTS public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[], TEXT);
DROP FUNCTION IF EXISTS public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[], TEXT, JSONB);

DROP FUNCTION IF EXISTS public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT, JSONB);

DROP FUNCTION IF EXISTS public.get_outings();
DROP FUNCTION IF EXISTS public.get_gang_outings(UUID);

-- 3. Create or replace create_outing with p_documents support
CREATE OR REPLACE FUNCTION public.create_outing(
    p_title TEXT,
    p_occurred_at TIMESTAMP WITH TIME ZONE,
    p_reason TEXT,
    p_info_obtained TEXT,
    p_images JSONB DEFAULT '[]'::jsonb,
    p_detective_ids UUID[] DEFAULT '{}',
    p_tag TEXT DEFAULT NULL,
    p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_user_id UUID;
BEGIN
    INSERT INTO public.outings (
        title, 
        occurred_at, 
        reason, 
        info_obtained, 
        images, 
        created_by, 
        tag,
        documents
    )
    VALUES (
        p_title, 
        p_occurred_at, 
        p_reason, 
        p_info_obtained, 
        COALESCE(p_images, '[]'::jsonb), 
        auth.uid(), 
        p_tag,
        COALESCE(p_documents, '[]'::jsonb)
    )
    RETURNING id INTO v_new_id;

    -- Insert Detectives
    IF array_length(p_detective_ids, 1) > 0 THEN
        FOREACH v_user_id IN ARRAY p_detective_ids
        LOOP
            INSERT INTO public.outing_detectives (outing_id, user_id) 
            VALUES (v_new_id, v_user_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_outing(TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, UUID[], TEXT, JSONB) TO authenticated;

-- 4. Create or replace update_outing with p_documents support
CREATE OR REPLACE FUNCTION public.update_outing(
    p_outing_id UUID,
    p_title TEXT,
    p_occurred_at TIMESTAMP WITH TIME ZONE,
    p_reason TEXT,
    p_info_obtained TEXT,
    p_images JSONB DEFAULT '[]'::jsonb,
    p_tag TEXT DEFAULT NULL,
    p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.outings
    SET 
        title = p_title,
        occurred_at = p_occurred_at,
        reason = p_reason,
        info_obtained = p_info_obtained,
        images = COALESCE(p_images, '[]'::jsonb),
        tag = p_tag,
        documents = COALESCE(p_documents, '[]'::jsonb)
    WHERE id = p_outing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_outing(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, JSONB, TEXT, JSONB) TO authenticated;

-- 5. Create or replace get_outings returning interrogations and documents
CREATE OR REPLACE FUNCTION public.get_outings()
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    detectives JSONB,
    gang_id UUID,
    gang_names TEXT[],
    author_name TEXT,
    author_rank TEXT,
    author_avatar TEXT,
    can_delete BOOLEAN,
    tag TEXT,
    interrogations JSONB,
    documents JSONB
) AS $$
DECLARE
    v_uid UUID;
    v_user_role TEXT;
BEGIN
    v_uid := auth.uid();
    SELECT TRIM(u_auth.rol::text) INTO v_user_role FROM public.users u_auth WHERE u_auth.id = v_uid;

    RETURN QUERY
    SELECT 
        o.id,
        o.title,
        o.occurred_at,
        o.reason,
        o.info_obtained,
        COALESCE(o.images, '[]'::jsonb),
        o.created_at,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', u.id, 
                'name', u.nombre || ' ' || u.apellido, 
                'rank', u.rango,
                'avatar', u.profile_image
            ))
             FROM public.outing_detectives od
             JOIN public.users u ON od.user_id = u.id 
             WHERE od.outing_id = o.id),
            '[]'::jsonb
        ),
        (SELECT og.gang_id FROM public.outing_gangs og WHERE og.outing_id = o.id LIMIT 1),
        ARRAY(
            SELECT g.name 
            FROM public.outing_gangs og 
            JOIN public.gangs g ON og.gang_id = g.id 
            WHERE og.outing_id = o.id
            ORDER BY g.name
        )::TEXT[],
        COALESCE(u.nombre || ' ' || u.apellido, 'Unknown'),
        COALESCE(u.rango::text, 'N/A'),
        u.profile_image,
        (v_user_role IN ('Administrador', 'Coordinador', 'Comisionado', 'Detective') OR o.created_by = v_uid) as can_delete,
        o.tag,
        -- Linked interrogations
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', inter.id,
                'title', inter.title
            ))
            FROM public.outing_interrogations oi
            JOIN public.interrogations inter ON oi.interrogation_id = inter.id
            WHERE oi.outing_id = o.id),
            '[]'::jsonb
        ) as interrogations,
        -- Attached documents (PDFs, docs)
        COALESCE(o.documents, '[]'::jsonb) as documents
    FROM public.outings o
    LEFT JOIN public.users u ON o.created_by = u.id
    ORDER BY o.occurred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_outings() TO authenticated;

-- 6. Create or replace get_gang_outings returning documents
CREATE OR REPLACE FUNCTION public.get_gang_outings(p_gang_id UUID)
RETURNS TABLE (
    record_id UUID,
    title TEXT,
    occurred_at TIMESTAMPTZ,
    reason TEXT,
    info_obtained TEXT,
    images JSONB,
    author_id UUID,
    is_author BOOLEAN,
    can_delete BOOLEAN,
    detectives JSONB,
    tag TEXT,
    documents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_rango TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    SELECT rol INTO v_user_rango FROM users WHERE id = v_user_id;

    RETURN QUERY
    SELECT
        o.id as record_id,
        o.title,
        o.occurred_at,
        o.reason,
        o.info_obtained,
        COALESCE(o.images, '[]'::jsonb),
        o.created_by as author_id,
        (o.created_by = v_user_id) as is_author,
        (
            o.created_by = v_user_id OR
            v_user_rango IN ('Coordinador', 'Comisionado', 'Administrador', 'Admin', 'Detective')
        ) as can_delete,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'id', u.id,
                'name', u.nombre || ' ' || u.apellido,
                'rank', u.rango,
                'avatar', u.profile_image
            ))
            FROM outing_detectives od
            JOIN users u ON u.id = od.user_id
            WHERE od.outing_id = o.id
        ) as detectives,
        o.tag,
        COALESCE(o.documents, '[]'::jsonb) as documents
    FROM outings o
    JOIN outing_gangs og ON og.outing_id = o.id
    WHERE og.gang_id = p_gang_id
    ORDER BY o.occurred_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gang_outings(UUID) TO authenticated;
