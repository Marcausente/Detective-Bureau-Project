-- ==============================================================================
-- DISCORD WEBHOOK SYSTEM FOR IA COMPLAINTS / DENUNCIAS NOTIFICATIONS
-- ==============================================================================

-- 1. Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert Default Webhook Settings for IA Complaints
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_ia_complaints_webhook_url', ''),
  ('discord_ia_complaints_webhook_enabled', 'false'),
  ('discord_ia_complaints_webhook_role_ping', ''),
  ('discord_ia_complaints_webhook_bot_name', 'IA • Notificaciones de Denuncias'),
  ('discord_ia_complaints_webhook_bot_avatar', '/logowebp/IALSSD.webp'),
  ('discord_ia_complaints_webhook_custom_msg', '⚠️ **Nueva Denuncia Ciudadana Recibida**. Por favor, revisad la Base de Datos para verificarla y asignarla.')
ON CONFLICT (key) DO NOTHING;

-- 3. RPC to retrieve Discord IA Complaints Webhook configuration
DROP FUNCTION IF EXISTS public.get_discord_ia_complaints_webhook_config();
CREATE OR REPLACE FUNCTION get_discord_ia_complaints_webhook_config()
RETURNS JSONB AS $$
DECLARE
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_custom_msg TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_ia_complaints_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_ia_complaints_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_ia_complaints_webhook_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_ia_complaints_webhook_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_ia_complaints_webhook_bot_avatar';
    SELECT value INTO v_custom_msg FROM public.app_settings WHERE key = 'discord_ia_complaints_webhook_custom_msg';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled = 'true', false),
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'IA • Notificaciones de Denuncias'),
        'bot_avatar', COALESCE(v_bot_avatar, '/logowebp/IALSSD.webp'),
        'custom_msg', COALESCE(v_custom_msg, '⚠️ **Nueva Denuncia Ciudadana Recibida**. Por favor, revisad la Base de Datos para verificarla y asignarla.')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC to save Discord IA Complaints Webhook configuration
DROP FUNCTION IF EXISTS public.save_discord_ia_complaints_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_discord_ia_complaints_webhook_config(
    p_webhook_url TEXT,
    p_enabled BOOLEAN,
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'IA • Notificaciones de Denuncias',
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
        v_user_role NOT ILIKE '%asuntos internos%' AND
        v_user_role NOT ILIKE '%ia%'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Internal Affairs & Leadership can modify IA Webhook settings.';
    END IF;

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_ia_complaints_webhook_url', COALESCE(p_webhook_url, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_ia_complaints_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_ia_complaints_webhook_role_ping', COALESCE(p_role_ping, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_ia_complaints_webhook_bot_name', COALESCE(p_bot_name, 'IA • Notificaciones de Denuncias'), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_ia_complaints_webhook_bot_avatar', COALESCE(p_bot_avatar, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('discord_ia_complaints_webhook_custom_msg', COALESCE(p_custom_msg, ''), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_discord_ia_complaints_webhook_config() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_discord_ia_complaints_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO authenticated;
