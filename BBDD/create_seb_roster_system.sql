-- ==============================================================================
-- SEB ROSTER & DISCORD BROADCAST SYSTEM (SPECIAL ENFORCEMENT BUREAU / TRT)
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
        rango::text ILIKE '%seb%' OR
        divisions::text ILIKE '%seb%' OR
        subdivisions::text ILIKE '%seb%'
      )
    )
  );

GRANT ALL ON TABLE public.app_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon;

-- 2. Insert default keys for SEB Roster
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_seb_roster_webhook_url', ''),
  ('discord_seb_roster_webhook_enabled', 'false'),
  ('discord_seb_roster_role_ping', ''),
  ('discord_seb_roster_bot_name', 'SEB • Special Enforcement Bureau'),
  ('discord_seb_roster_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub.webp'),
  ('discord_seb_roster_title', 'Miembros e indicativos.'),
  ('discord_seb_roster_banner_url', ''),
  ('discord_seb_roster_data', '[
    {
      "id": "team-seb",
      "teamName": "Equipo S.E.B.",
      "teamIcon": "🦇",
      "groups": [
        {
          "id": "grp-seb-supervision",
          "name": "SUPERVISION SEB",
          "icon": "",
          "members": [
            {"id": "m-1", "callsign": "SIERRA-10", "name": "Leah Bailey", "discordId": "", "badge": "700"}
          ]
        },
        {
          "id": "grp-sierra-20",
          "name": "GRUPO SIERRA - 20",
          "icon": "🦇",
          "members": [
            {"id": "m-2", "callsign": "SIERRA-20", "name": "Ryan Daniels", "discordId": "", "badge": "715"},
            {"id": "m-3", "callsign": "SIERRA-21", "name": "William Kleiner", "discordId": "", "badge": "713 | Mr.Kai_tv"},
            {"id": "m-4", "callsign": "SIERRA-22", "name": "Deacon McCoy", "discordId": "", "badge": "710"},
            {"id": "m-5", "callsign": "SIERRA-23", "name": "Liam Crawford", "discordId": "", "badge": "711"},
            {"id": "m-6", "callsign": "SIERRA-24", "name": "alexdop", "discordId": "", "badge": ""}
          ]
        }
      ]
    },
    {
      "id": "team-trt",
      "teamName": "Equipo T.R.T.",
      "teamIcon": "🦅",
      "groups": [
        {
          "id": "grp-roger-10",
          "name": "GRUPO ROGER - 10",
          "icon": "🦅",
          "members": [
            {"id": "m-7", "callsign": "ROGER - 10", "name": "Ryder Crawford", "discordId": "", "badge": "786"},
            {"id": "m-8", "callsign": "ROGER - 11", "name": "Alejandro Diaz", "discordId": "", "badge": "730 | jyissus15"},
            {"id": "m-9", "callsign": "ROGER - 12", "name": "Axel Alfaro", "discordId": "", "badge": "771"},
            {"id": "m-10", "callsign": "ROGER - 13", "name": "David Pearson", "discordId": "", "badge": "740"}
          ]
        },
        {
          "id": "grp-roger-20",
          "name": "GRUPO ROGER - 20",
          "icon": "🦅",
          "members": [
            {"id": "m-11", "callsign": "ROGER - 20", "name": "Maverick Rose", "discordId": "", "badge": "743"},
            {"id": "m-12", "callsign": "ROGER - 21", "name": "Nyla Parker", "discordId": "", "badge": "746"},
            {"id": "m-13", "callsign": "ROGER - 22", "name": "Val Sttaford", "discordId": "", "badge": "784"},
            {"id": "m-14", "callsign": "ROGER - 23", "name": "Ethan Alfaro", "discordId": "", "badge": "781"}
          ]
        }
      ]
    }
  ]')
ON CONFLICT (key) DO NOTHING;

-- 3. RPC to get SEB Roster Configuration & Data
DROP FUNCTION IF EXISTS public.get_seb_roster_config();
CREATE OR REPLACE FUNCTION get_seb_roster_config()
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
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_seb_roster_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_seb_roster_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_seb_roster_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_seb_roster_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_seb_roster_bot_avatar';
    SELECT value INTO v_title FROM public.app_settings WHERE key = 'discord_seb_roster_title';
    SELECT value INTO v_banner_url FROM public.app_settings WHERE key = 'discord_seb_roster_banner_url';
    SELECT value INTO v_data FROM public.app_settings WHERE key = 'discord_seb_roster_data';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'false') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'SEB • Special Enforcement Bureau'),
        'bot_avatar', COALESCE(v_bot_avatar, ''),
        'title', COALESCE(v_title, 'Miembros e indicativos.'),
        'banner_url', COALESCE(v_banner_url, ''),
        'roster_data', CASE 
            WHEN v_data IS NOT NULL AND v_data <> '' THEN v_data::JSONB 
            ELSE '[]'::JSONB 
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC to save SEB Roster Configuration & Data
DROP FUNCTION IF EXISTS public.save_seb_roster_config(JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION save_seb_roster_config(
    p_roster_data JSONB,
    p_webhook_url TEXT DEFAULT '',
    p_title TEXT DEFAULT 'Miembros e indicativos.',
    p_banner_url TEXT DEFAULT '',
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'SEB • Special Enforcement Bureau',
    p_bot_avatar TEXT DEFAULT '',
    p_enabled BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES 
        ('discord_seb_roster_data', p_roster_data::TEXT, NOW()),
        ('discord_seb_roster_webhook_url', p_webhook_url, NOW()),
        ('discord_seb_roster_title', p_title, NOW()),
        ('discord_seb_roster_banner_url', p_banner_url, NOW()),
        ('discord_seb_roster_role_ping', p_role_ping, NOW()),
        ('discord_seb_roster_bot_name', p_bot_name, NOW()),
        ('discord_seb_roster_bot_avatar', p_bot_avatar, NOW()),
        ('discord_seb_roster_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW())
    ON CONFLICT (key) DO UPDATE 
    SET value = EXCLUDED.value,
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
