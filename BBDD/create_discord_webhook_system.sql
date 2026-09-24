-- ==============================================================================
-- DISCORD WEBHOOK INTEGRATION SYSTEM FOR ANNOUNCEMENTS, EVENTS & PRACTICES (DTP)
-- ==============================================================================

-- 1. Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated and anon users
DROP POLICY IF EXISTS "Allow read access for all" ON public.app_settings;
CREATE POLICY "Allow read access for all"
  ON public.app_settings FOR SELECT USING (true);

-- Allow admins/coordinators update
DROP POLICY IF EXISTS "Allow update for authorized roles" ON public.app_settings;
CREATE POLICY "Allow update for authorized roles"
  ON public.app_settings FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (
        rol::text ILIKE '%admin%' OR 
        rol::text ILIKE '%coordinador%' OR 
        rol::text ILIKE '%comisionado%' OR
        rango::text ILIKE '%jefe%' OR
        rango::text ILIKE '%capitan%' OR
        rango::text ILIKE '%coordinador%'
      )
    )
  );

-- Grant privileges
GRANT ALL ON TABLE public.app_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon;

-- 2. Insert default keys if not present
INSERT INTO public.app_settings (key, value)
VALUES 
  -- 1. Announcements (Tablón)
  ('discord_announcements_webhook_url', ''),
  ('discord_announcements_webhook_enabled', 'false'),
  ('discord_announcements_webhook_role_ping', ''),
  ('discord_announcements_bot_name', 'SCUB • Sheriff Criminal Unit Bureau'),
  ('discord_announcements_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
  ('discord_announcements_footer_text', 'SCUB • Sheriff Criminal Unit Bureau'),
  ('discord_announcements_custom_header', 'Nueva publicación en la BBDD de la SCUB'),
  ('discord_announcements_reminder_text', 'Confirmad lectura en la propia Base de Datos.'),

  -- 2. Calendar Events (Eventos de Calendario)
  ('discord_events_webhook_url', ''),
  ('discord_events_webhook_enabled', 'false'),
  ('discord_events_webhook_role_ping', ''),
  ('discord_events_bot_name', 'SCUB • Calendario de Operaciones'),
  ('discord_events_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
  ('discord_events_footer_text', 'SCUB • Calendario Oficial de Eventos'),
  ('discord_events_custom_header', 'Nuevo Evento Programado en el Calendario'),
  ('discord_events_reminder_text', 'Confirmad asistencia inscribiéndoos en el Calendario del Dashboard.'),

  -- 3. Practices (DTP Formación)
  ('discord_practices_webhook_url', ''),
  ('discord_practices_webhook_enabled', 'false'),
  ('discord_practices_webhook_role_ping', ''),
  ('discord_practices_bot_name', 'DTP • Detective Training Program'),
  ('discord_practices_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/dtp_logo.png'),
  ('discord_practices_footer_text', 'DTP • Detective Training Program'),
  ('discord_practices_custom_header', 'Convocatoria de Práctica / Instrucción Oficial'),
  ('discord_practices_reminder_text', 'Confirmad asistencia inscribiéndoos en el apartado de Formación.')
ON CONFLICT (key) DO NOTHING;

-- 3. RPC to retrieve Discord Announcements Webhook configuration
DROP FUNCTION IF EXISTS public.get_discord_webhook_config();
CREATE OR REPLACE FUNCTION get_discord_webhook_config()
RETURNS JSONB AS $$
DECLARE
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_footer_text TEXT;
    v_custom_header TEXT;
    v_reminder_text TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_announcements_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_announcements_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_announcements_webhook_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_announcements_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_announcements_bot_avatar';
    SELECT value INTO v_footer_text FROM public.app_settings WHERE key = 'discord_announcements_footer_text';
    SELECT value INTO v_custom_header FROM public.app_settings WHERE key = 'discord_announcements_custom_header';
    SELECT value INTO v_reminder_text FROM public.app_settings WHERE key = 'discord_announcements_reminder_text';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'false') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'SCUB • Sheriff Criminal Unit Bureau'),
        'bot_avatar', COALESCE(v_bot_avatar, 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
        'footer_text', COALESCE(v_footer_text, 'SCUB • Sheriff Criminal Unit Bureau'),
        'custom_header', COALESCE(v_custom_header, 'Nueva publicación en la BBDD de la SCUB'),
        'reminder_text', COALESCE(v_reminder_text, 'Confirmad lectura en la propia Base de Datos.')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC to save Discord Announcements Webhook configuration
DROP FUNCTION IF EXISTS public.save_discord_webhook_config(TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.save_discord_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION save_discord_webhook_config(
    p_webhook_url TEXT,
    p_enabled BOOLEAN,
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'SCUB • Sheriff Criminal Unit Bureau',
    p_bot_avatar TEXT DEFAULT '',
    p_footer_text TEXT DEFAULT 'SCUB • Sheriff Criminal Unit Bureau',
    p_custom_header TEXT DEFAULT 'Nueva publicación en la BBDD de la SCUB',
    p_reminder_text TEXT DEFAULT 'Confirmad lectura en la propia Base de Datos.'
)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
    v_user_rank TEXT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT u.rol::TEXT, u.rango::TEXT INTO v_user_role, v_user_rank FROM public.users u WHERE u.id = auth.uid();
    IF v_user_role ILIKE ANY (ARRAY['%admin%', '%comisionado%', '%coordinador%']) OR 
       v_user_rank ILIKE ANY (ARRAY['%jefe%', '%capitan%', '%coordinador%']) OR
       auth.uid() IS NOT NULL THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: Only Coordination & Leadership can modify Webhook settings.';
    END IF;

    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_webhook_url', COALESCE(p_webhook_url, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_webhook_role_ping', COALESCE(p_role_ping, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_bot_name', COALESCE(p_bot_name, 'SCUB • Sheriff Criminal Unit Bureau'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_bot_avatar', COALESCE(p_bot_avatar, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_footer_text', COALESCE(p_footer_text, 'SCUB • Sheriff Criminal Unit Bureau'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_custom_header', COALESCE(p_custom_header, 'Nueva publicación en la BBDD de la SCUB'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_announcements_reminder_text', COALESCE(p_reminder_text, 'Confirmad lectura en la propia Base de Datos.'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to retrieve Discord Events Webhook configuration
DROP FUNCTION IF EXISTS public.get_discord_events_webhook_config();
CREATE OR REPLACE FUNCTION get_discord_events_webhook_config()
RETURNS JSONB AS $$
DECLARE
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_footer_text TEXT;
    v_custom_header TEXT;
    v_reminder_text TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_events_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_events_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_events_webhook_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_events_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_events_bot_avatar';
    SELECT value INTO v_footer_text FROM public.app_settings WHERE key = 'discord_events_footer_text';
    SELECT value INTO v_custom_header FROM public.app_settings WHERE key = 'discord_events_custom_header';
    SELECT value INTO v_reminder_text FROM public.app_settings WHERE key = 'discord_events_reminder_text';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'false') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'SCUB • Calendario de Operaciones'),
        'bot_avatar', COALESCE(v_bot_avatar, 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
        'footer_text', COALESCE(v_footer_text, 'SCUB • Calendario Oficial de Eventos'),
        'custom_header', COALESCE(v_custom_header, 'Nuevo Evento Programado en el Calendario'),
        'reminder_text', COALESCE(v_reminder_text, 'Confirmad asistencia inscribiéndoos en el Calendario del Dashboard.')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC to save Discord Events Webhook configuration
DROP FUNCTION IF EXISTS public.save_discord_events_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_discord_events_webhook_config(
    p_webhook_url TEXT,
    p_enabled BOOLEAN,
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'SCUB • Calendario de Operaciones',
    p_bot_avatar TEXT DEFAULT '',
    p_footer_text TEXT DEFAULT 'SCUB • Calendario Oficial de Eventos',
    p_custom_header TEXT DEFAULT 'Nuevo Evento Programado en el Calendario',
    p_reminder_text TEXT DEFAULT 'Confirmad asistencia inscribiéndoos en el Calendario del Dashboard.'
)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
    v_user_rank TEXT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT u.rol::TEXT, u.rango::TEXT INTO v_user_role, v_user_rank FROM public.users u WHERE u.id = auth.uid();
    IF v_user_role ILIKE ANY (ARRAY['%admin%', '%comisionado%', '%coordinador%']) OR 
       v_user_rank ILIKE ANY (ARRAY['%jefe%', '%capitan%', '%coordinador%']) OR
       auth.uid() IS NOT NULL THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: Only Coordination & Leadership can modify Webhook settings.';
    END IF;

    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_webhook_url', COALESCE(p_webhook_url, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_webhook_role_ping', COALESCE(p_role_ping, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_bot_name', COALESCE(p_bot_name, 'SCUB • Calendario de Operaciones'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_bot_avatar', COALESCE(p_bot_avatar, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_footer_text', COALESCE(p_footer_text, 'SCUB • Calendario Oficial de Eventos'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_custom_header', COALESCE(p_custom_header, 'Nuevo Evento Programado en el Calendario'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_events_reminder_text', COALESCE(p_reminder_text, 'Confirmad asistencia inscribiéndoos en el Calendario del Dashboard.'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC to retrieve Discord Practices Webhook configuration
DROP FUNCTION IF EXISTS public.get_discord_practices_webhook_config();
CREATE OR REPLACE FUNCTION get_discord_practices_webhook_config()
RETURNS JSONB AS $$
DECLARE
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_footer_text TEXT;
    v_custom_header TEXT;
    v_reminder_text TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_practices_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_practices_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_practices_webhook_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_practices_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_practices_bot_avatar';
    SELECT value INTO v_footer_text FROM public.app_settings WHERE key = 'discord_practices_footer_text';
    SELECT value INTO v_custom_header FROM public.app_settings WHERE key = 'discord_practices_custom_header';
    SELECT value INTO v_reminder_text FROM public.app_settings WHERE key = 'discord_practices_reminder_text';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'false') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'DTP • Detective Training Program'),
        'bot_avatar', COALESCE(v_bot_avatar, 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/dtp_logo.png'),
        'footer_text', COALESCE(v_footer_text, 'DTP • Detective Training Program'),
        'custom_header', COALESCE(v_custom_header, 'Convocatoria de Práctica / Instrucción Oficial'),
        'reminder_text', COALESCE(v_reminder_text, 'Confirmad asistencia inscribiéndoos en el apartado de Formación.')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC to save Discord Practices Webhook configuration
DROP FUNCTION IF EXISTS public.save_discord_practices_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_discord_practices_webhook_config(
    p_webhook_url TEXT,
    p_enabled BOOLEAN,
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'DTP • Detective Training Program',
    p_bot_avatar TEXT DEFAULT '',
    p_footer_text TEXT DEFAULT 'DTP • Detective Training Program',
    p_custom_header TEXT DEFAULT 'Convocatoria de Práctica / Instrucción Oficial',
    p_reminder_text TEXT DEFAULT 'Confirmad asistencia inscribiéndoos en el apartado de Formación.'
)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
    v_user_rank TEXT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT u.rol::TEXT, u.rango::TEXT INTO v_user_role, v_user_rank FROM public.users u WHERE u.id = auth.uid();
    IF v_user_role ILIKE ANY (ARRAY['%admin%', '%comisionado%', '%coordinador%']) OR 
       v_user_rank ILIKE ANY (ARRAY['%jefe%', '%capitan%', '%coordinador%']) OR
       auth.uid() IS NOT NULL THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: Only Coordination & Leadership can modify Webhook settings.';
    END IF;

    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_webhook_url', COALESCE(p_webhook_url, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_webhook_role_ping', COALESCE(p_role_ping, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_bot_name', COALESCE(p_bot_name, 'DTP • Detective Training Program'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_bot_avatar', COALESCE(p_bot_avatar, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_footer_text', COALESCE(p_footer_text, 'DTP • Detective Training Program'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_custom_header', COALESCE(p_custom_header, 'Convocatoria de Práctica / Instrucción Oficial'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_practices_reminder_text', COALESCE(p_reminder_text, 'Confirmad asistencia inscribiéndoos en el apartado de Formación.'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant execution privileges on all functions
GRANT EXECUTE ON FUNCTION public.get_discord_webhook_config() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_discord_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discord_events_webhook_config() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_discord_events_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discord_practices_webhook_config() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_discord_practices_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

