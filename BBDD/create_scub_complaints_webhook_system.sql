-- ==============================================================================
-- DISCORD WEBHOOK SYSTEM & PUBLIC FORM FOR SCUB / GENERAL CRIMES COMPLAINTS
-- ==============================================================================

-- 1. Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert Default Webhook Settings for SCUB Complaints
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_scub_complaints_webhook_url', ''),
  ('discord_scub_complaints_webhook_enabled', 'false'),
  ('discord_scub_complaints_webhook_role_ping', ''),
  ('discord_scub_complaints_webhook_bot_name', 'SCUB • Registro de Denuncias'),
  ('discord_scub_complaints_webhook_bot_avatar', '/logowebp/SCUB.webp'),
  ('discord_scub_complaints_webhook_custom_msg', '📜 **Nueva Denuncia Ciudadana Registrada (SCUB)**. Se ha recibido una nueva denuncia en el sistema. Revisad el registro para iniciar la investigación y asignar detectives.')
ON CONFLICT (key) DO NOTHING;

-- 3. Public RPC to insert a complaint without requiring authentication
DROP FUNCTION IF EXISTS public.create_public_denuncia(JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_public_denuncia(
    p_complainants JSONB,
    p_accused JSONB,
    p_motivo TEXT,
    p_acontecimientos TEXT,
    p_solicitud TEXT DEFAULT NULL,
    p_notas TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_titulo TEXT DEFAULT 'Denuncia Ciudadana'
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.denuncias (
        case_id,
        status,
        complainants,
        accused,
        motivo,
        acontecimientos,
        solicitud,
        notas,
        image_url,
        author_id,
        titulo,
        created_at
    )
    VALUES (
        NULL,
        'Open',
        p_complainants,
        p_accused,
        p_motivo,
        p_acontecimientos,
        p_solicitud,
        p_notas,
        p_image_url,
        auth.uid(), -- Will be NULL for anonymous public submissions
        COALESCE(p_titulo, 'Denuncia Ciudadana'),
        NOW()
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_public_denuncia(JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 4. RPC to retrieve Discord SCUB Complaints Webhook configuration
DROP FUNCTION IF EXISTS public.get_discord_scub_complaints_webhook_config();
CREATE OR REPLACE FUNCTION get_discord_scub_complaints_webhook_config()
RETURNS JSONB AS $$
DECLARE
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_custom_msg TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_scub_complaints_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_scub_complaints_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_scub_complaints_webhook_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_scub_complaints_webhook_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_scub_complaints_webhook_bot_avatar';
    SELECT value INTO v_custom_msg FROM public.app_settings WHERE key = 'discord_scub_complaints_webhook_custom_msg';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled = 'true', false),
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'SCUB • Registro de Denuncias'),
        'bot_avatar', COALESCE(v_bot_avatar, '/logowebp/SCUB.webp'),
        'custom_msg', COALESCE(v_custom_msg, '📜 **Nueva Denuncia Ciudadana Registrada (SCUB)**. Se ha recibido una nueva denuncia en el sistema. Revisad el registro para iniciar la investigación y asignar detectives.')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to save Discord SCUB Complaints Webhook configuration
DROP FUNCTION IF EXISTS public.save_discord_scub_complaints_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_discord_scub_complaints_webhook_config(
    p_webhook_url TEXT,
    p_enabled BOOLEAN,
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'SCUB • Registro de Denuncias',
    p_bot_avatar TEXT DEFAULT '',
    p_custom_msg TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- Authorization check
    SELECT rol INTO v_user_role FROM public.users WHERE id = auth.uid();
    
    IF v_user_role IS NULL OR (
        v_user_role NOT ILIKE '%admin%' AND 
        v_user_role NOT ILIKE '%coordinador%' AND 
        v_user_role NOT ILIKE '%comisionado%' AND
        v_user_role NOT ILIKE '%director%' AND
        v_user_role NOT ILIKE '%detective%' AND
        v_user_role NOT ILIKE '%agente%' AND
        v_user_role NOT ILIKE '%investigador%'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated department members can modify SCUB Webhook settings.';
    END IF;

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_scub_complaints_webhook_url', COALESCE(p_webhook_url, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_scub_complaints_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_scub_complaints_webhook_role_ping', COALESCE(p_role_ping, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_scub_complaints_webhook_bot_name', COALESCE(p_bot_name, 'SCUB • Registro de Denuncias'), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_scub_complaints_webhook_bot_avatar', COALESCE(p_bot_avatar, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_scub_complaints_webhook_custom_msg', COALESCE(p_custom_msg, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_discord_scub_complaints_webhook_config() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_discord_scub_complaints_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO authenticated;
