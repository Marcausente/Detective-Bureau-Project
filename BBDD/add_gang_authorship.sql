-- ============================================================
-- GANG AUTHORSHIP MIGRATION
-- Adds 'added_by' column to gang_vehicles, gang_homes
-- and gang_members so every piece of intelligence shows
-- which detective uploaded it.
-- ============================================================

-- 1. ADD COLUMNS (safe: only if they don't exist yet)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gang_vehicles' AND column_name = 'added_by'
    ) THEN
        ALTER TABLE public.gang_vehicles
            ADD COLUMN added_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gang_homes' AND column_name = 'added_by'
    ) THEN
        ALTER TABLE public.gang_homes
            ADD COLUMN added_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gang_members' AND column_name = 'added_by'
    ) THEN
        ALTER TABLE public.gang_members
            ADD COLUMN added_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 2. UPDATE INSERT RPCs TO CAPTURE auth.uid() AS added_by

CREATE OR REPLACE FUNCTION add_gang_vehicle(
    p_gang_id UUID, p_model TEXT, p_plate TEXT,
    p_owner TEXT, p_notes TEXT, p_images JSONB
) RETURNS UUID AS $$
DECLARE v_id UUID; BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.gang_vehicles (gang_id, model, plate, owner_name, notes, images, added_by)
    VALUES (p_gang_id, p_model, p_plate, p_owner, p_notes, p_images, auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_gang_home(
    p_gang_id UUID, p_owner TEXT, p_notes TEXT, p_images JSONB
) RETURNS UUID AS $$
DECLARE v_id UUID; BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.gang_homes (gang_id, owner_name, address_notes, images, added_by)
    VALUES (p_gang_id, p_owner, p_notes, p_images, auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_gang_member(
    p_gang_id UUID, p_name TEXT, p_role TEXT, p_photo TEXT, p_notes TEXT
) RETURNS UUID AS $$
DECLARE v_id UUID; BEGIN
    IF NOT auth_is_gang_authorized() THEN RAISE EXCEPTION 'Access Denied'; END IF;
    INSERT INTO public.gang_members (gang_id, name, role, photo, notes, added_by)
    VALUES (p_gang_id, p_name, p_role, p_photo, p_notes, auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. UPDATE get_gangs_data() TO INCLUDE AUTHOR NAMES

DROP FUNCTION IF EXISTS get_gangs_data();
CREATE OR REPLACE FUNCTION get_gangs_data()
RETURNS TABLE (
    gang_id        UUID,
    name           TEXT,
    color          TEXT,
    zones_image    TEXT,
    is_archived    BOOLEAN,
    vehicles       JSONB,
    homes          JSONB,
    members        JSONB,
    info           JSONB,
    incident_count BIGINT,
    outing_count   BIGINT
) AS $$
BEGIN
    IF NOT auth_is_gang_authorized() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        g.id AS gang_id,
        g.name,
        g.color,
        g.zones_image,
        g.is_archived,

        -- Vehicles (includes added_by_name)
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           v.id,
                    'model',        v.model,
                    'plate',        v.plate,
                    'owner',        v.owner_name,
                    'notes',        v.notes,
                    'images',       v.images,
                    'added_by_name',(
                        SELECT u.nombre || ' ' || u.apellido
                        FROM public.users u WHERE u.id = v.added_by
                    )
                )
            )
            FROM public.gang_vehicles v WHERE v.gang_id = g.id
        ), '[]'::jsonb),

        -- Homes (includes added_by_name)
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           h.id,
                    'owner',        h.owner_name,
                    'notes',        h.address_notes,
                    'images',       h.images,
                    'added_by_name',(
                        SELECT u.nombre || ' ' || u.apellido
                        FROM public.users u WHERE u.id = h.added_by
                    )
                )
            )
            FROM public.gang_homes h WHERE h.gang_id = g.id
        ), '[]'::jsonb),

        -- Members (includes added_by_name)
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',           m.id,
                    'name',         m.name,
                    'role',         m.role,
                    'photo',        m.photo,
                    'notes',        m.notes,
                    'status',       m.status,
                    'added_by_name',(
                        SELECT u.nombre || ' ' || u.apellido
                        FROM public.users u WHERE u.id = m.added_by
                    )
                )
            )
            FROM public.gang_members m WHERE m.gang_id = g.id
        ), '[]'::jsonb),

        -- Info (already has author via author_id)
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',      i.id,
                    'type',    i.type,
                    'content', i.content,
                    'images',  i.images,
                    'author',  (
                        SELECT u.nombre || ' ' || u.apellido
                        FROM public.users u WHERE u.id = i.author_id
                    )
                )
            )
            FROM public.gang_info i WHERE i.gang_id = g.id
        ), '[]'::jsonb),

        -- Counts
        (SELECT COUNT(*) FROM public.incidents inc WHERE inc.gang_id = g.id),
        (SELECT COUNT(*) FROM public.outings   out WHERE out.gang_id = g.id)

    FROM public.gangs g
    ORDER BY g.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
