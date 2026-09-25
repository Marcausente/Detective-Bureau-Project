-- ==============================================================================
-- IA ROSTER & DISCORD BROADCAST SYSTEM (INTERNAL AFFAIRS BUREAU)
-- ==============================================================================

-- 1. Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for all" ON public.app_settings;
CREATE POLICY "Allow read access for all"
  ON public.app_settings FOR SELECT USING (true);

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
        rango::text ILIKE '%sargento%' OR
        divisions::text ILIKE '%ia%' OR
        divisions::text ILIKE '%internal affairs%' OR
        subdivisions::text ILIKE '%ia%' OR
        subdivisions::text ILIKE '%internal affairs%'
      )
    )
  );

GRANT ALL ON TABLE public.app_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon;

-- 2. Insert default keys for IA Roster
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_ia_roster_webhook_url', ''),
  ('discord_ia_roster_webhook_enabled', 'false'),
  ('discord_ia_roster_role_ping', ''),
  ('discord_ia_roster_bot_name', 'Internal Affairs Bureau'),
  ('discord_ia_roster_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/ia_logo.png'),
  ('discord_ia_roster_title', 'INTERNAL AFFAIRS BUREAU - MIEMBROS'),
  ('discord_ia_roster_banner_url', ''),
  ('discord_ia_roster_data', '[
    {"id":"ia_coord","name":"COORDINADORA","icon":"⚖️","members":[]},
    {"id":"ia_subcoord","name":"SUBCOORDINADOR","icon":"⚡","members":[]},
    {"id":"ia_oficina_disc","name":"AGENTES OFICINA DISCIPLINARIA","icon":"🕵️","members":[]},
    {"id":"ia_oficina_inv","name":"AGENTES OFICINA DE INVESTIGACIÓN","icon":"🔍","members":[]}
  ]')
ON CONFLICT (key) DO NOTHING;

-- 3. RPC to get IA Roster Configuration & Data
DROP FUNCTION IF EXISTS public.get_ia_roster_config();
CREATE OR REPLACE FUNCTION get_ia_roster_config()
RETURNS JSONB AS $$
DECLARE
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_title TEXT;
    v_banner_url TEXT;
    v_data TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_ia_roster_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_ia_roster_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_ia_roster_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_ia_roster_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_ia_roster_bot_avatar';
    SELECT value INTO v_title FROM public.app_settings WHERE key = 'discord_ia_roster_title';
    SELECT value INTO v_banner_url FROM public.app_settings WHERE key = 'discord_ia_roster_banner_url';
    SELECT value INTO v_data FROM public.app_settings WHERE key = 'discord_ia_roster_data';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'false') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'Internal Affairs Bureau'),
        'bot_avatar', COALESCE(v_bot_avatar, ''),
        'title', COALESCE(v_title, 'INTERNAL AFFAIRS BUREAU - MIEMBROS'),
        'banner_url', COALESCE(v_banner_url, ''),
        'roster_data', CASE 
            WHEN v_data IS NOT NULL AND v_data <> '' THEN v_data::JSONB 
            ELSE '[]'::JSONB 
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC to save IA Roster Configuration & Data
DROP FUNCTION IF EXISTS public.save_ia_roster_config(JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION save_ia_roster_config(
    p_roster_data JSONB,
    p_webhook_url TEXT DEFAULT '',
    p_title TEXT DEFAULT 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
    p_banner_url TEXT DEFAULT '',
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'Internal Affairs Bureau',
    p_bot_avatar TEXT DEFAULT '',
    p_enabled BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_data', p_roster_data::TEXT, NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_webhook_url', COALESCE(p_webhook_url, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_title', COALESCE(p_title, 'INTERNAL AFFAIRS BUREAU - MIEMBROS'), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_banner_url', COALESCE(p_banner_url, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_role_ping', COALESCE(p_role_ping, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_bot_name', COALESCE(p_bot_name, 'Internal Affairs Bureau'), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_bot_avatar', COALESCE(p_bot_avatar, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_ia_roster_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
