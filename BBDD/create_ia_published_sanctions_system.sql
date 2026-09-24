-- ==============================================================================
-- INTERNAL AFFAIRS (IA) SANCTIONS DISCORD PUBLISHING & BANNERS SYSTEM
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
        subdivision::text ILIKE '%internal affairs%' OR
        subdivision::text ILIKE '%ia%'
      )
    )
  );

GRANT ALL ON TABLE public.app_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon;

-- 2. Insert default keys for IA Sanctions Webhook & Banners
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_ia_sanctions_webhook_url', ''),
  ('discord_ia_sanctions_webhook_enabled', 'false'),
  ('discord_ia_sanctions_webhook_role_ping', ''),
  ('discord_ia_sanctions_bot_name', 'INTERNAL AFFAIRS BUREAU'),
  ('discord_ia_sanctions_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/ia_logo.png'),
  ('discord_ia_sanctions_footer_text', 'Internal Affairs Bureau • Régimen Disciplinario'),
  ('discord_ia_sanctions_custom_header', 'MOTIVO: {motivo}'),
  ('discord_ia_sanctions_reminder_text', ''),
  ('discord_ia_banner_leves_sargentos', ''),
  ('discord_ia_banner_leves_ia', ''),
  ('discord_ia_banner_medias', ''),
  ('discord_ia_banner_graves', ''),
  ('discord_ia_banner_despido', '')
ON CONFLICT (key) DO NOTHING;

-- 3. Create ia_published_sanctions table
CREATE TABLE IF NOT EXISTS public.ia_published_sanctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sanction_type TEXT NOT NULL, -- 'leves_sargentos', 'leves_ia', 'medias', 'graves', 'despido'
    officer_name TEXT NOT NULL,
    officer_badge TEXT DEFAULT '',
    officer_rank TEXT DEFAULT '',
    reason TEXT NOT NULL,
    sanction_applied TEXT NOT NULL,
    sanctioner_name TEXT DEFAULT '',
    sanction_date DATE DEFAULT CURRENT_DATE,
    evidence_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    discord_sent BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ia_published_sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select ia_published_sanctions for authenticated" ON public.ia_published_sanctions;
CREATE POLICY "Allow select ia_published_sanctions for authenticated"
  ON public.ia_published_sanctions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all for authorized ia members" ON public.ia_published_sanctions;
CREATE POLICY "Allow all for authorized ia members"
  ON public.ia_published_sanctions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.ia_published_sanctions TO postgres, service_role, authenticated;

-- 4. RPC to get published sanctions
DROP FUNCTION IF EXISTS public.get_ia_published_sanctions();
CREATE OR REPLACE FUNCTION get_ia_published_sanctions()
RETURNS TABLE (
    id UUID,
    sanction_type TEXT,
    officer_name TEXT,
    officer_badge TEXT,
    officer_rank TEXT,
    reason TEXT,
    sanction_applied TEXT,
    sanctioner_name TEXT,
    sanction_date DATE,
    evidence_url TEXT,
    notes TEXT,
    banner_url TEXT,
    discord_sent BOOLEAN,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    creator_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.sanction_type,
        s.officer_name,
        s.officer_badge,
        s.officer_rank,
        s.reason,
        s.sanction_applied,
        s.sanctioner_name,
        s.sanction_date,
        s.evidence_url,
        s.notes,
        s.banner_url,
        s.discord_sent,
        s.created_by,
        s.created_at,
        COALESCE(u.nombre || ' ' || u.apellido, 'Asuntos Internos') AS creator_name
    FROM public.ia_published_sanctions s
    LEFT JOIN public.users u ON u.id = s.created_by
    ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to create published sanction
DROP FUNCTION IF EXISTS public.create_ia_published_sanction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION create_ia_published_sanction(
    p_sanction_type TEXT,
    p_officer_name TEXT,
    p_officer_badge TEXT DEFAULT '',
    p_officer_rank TEXT DEFAULT '',
    p_reason TEXT DEFAULT '',
    p_sanction_applied TEXT DEFAULT '',
    p_sanctioner_name TEXT DEFAULT '',
    p_sanction_date DATE DEFAULT CURRENT_DATE,
    p_evidence_url TEXT DEFAULT '',
    p_notes TEXT DEFAULT '',
    p_banner_url TEXT DEFAULT '',
    p_discord_sent BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.ia_published_sanctions (
        sanction_type,
        officer_name,
        officer_badge,
        officer_rank,
        reason,
        sanction_applied,
        sanctioner_name,
        sanction_date,
        evidence_url,
        notes,
        banner_url,
        discord_sent,
        created_by
    ) VALUES (
        p_sanction_type,
        p_officer_name,
        COALESCE(p_officer_badge, ''),
        COALESCE(p_officer_rank, ''),
        p_reason,
        p_sanction_applied,
        COALESCE(p_sanctioner_name, ''),
        COALESCE(p_sanction_date, CURRENT_DATE),
        COALESCE(p_evidence_url, ''),
        COALESCE(p_notes, ''),
        COALESCE(p_banner_url, ''),
        COALESCE(p_discord_sent, true),
        auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC to delete published sanction
DROP FUNCTION IF EXISTS public.delete_ia_published_sanction(UUID);
CREATE OR REPLACE FUNCTION delete_ia_published_sanction(p_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.ia_published_sanctions WHERE id = p_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC to get IA Sanctions Webhook Configuration
DROP FUNCTION IF EXISTS public.get_discord_ia_sanctions_webhook_config();
CREATE OR REPLACE FUNCTION get_discord_ia_sanctions_webhook_config()
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
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_ia_sanctions_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_ia_sanctions_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_ia_sanctions_webhook_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_ia_sanctions_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_ia_sanctions_bot_avatar';
    SELECT value INTO v_footer_text FROM public.app_settings WHERE key = 'discord_ia_sanctions_footer_text';
    SELECT value INTO v_custom_header FROM public.app_settings WHERE key = 'discord_ia_sanctions_custom_header';
    SELECT value INTO v_reminder_text FROM public.app_settings WHERE key = 'discord_ia_sanctions_reminder_text';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'false') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', COALESCE(v_bot_name, 'INTERNAL AFFAIRS BUREAU'),
        'bot_avatar', COALESCE(v_bot_avatar, ''),
        'footer_text', COALESCE(v_footer_text, 'Internal Affairs Bureau • Régimen Disciplinario'),
        'custom_header', COALESCE(v_custom_header, 'MOTIVO: {motivo}'),
        'reminder_text', COALESCE(v_reminder_text, '')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC to save IA Sanctions Webhook Configuration
DROP FUNCTION IF EXISTS public.save_discord_ia_sanctions_webhook_config(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_discord_ia_sanctions_webhook_config(
    p_webhook_url TEXT,
    p_enabled BOOLEAN,
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT 'INTERNAL AFFAIRS BUREAU',
    p_bot_avatar TEXT DEFAULT '',
    p_footer_text TEXT DEFAULT 'Internal Affairs Bureau • Régimen Disciplinario',
    p_custom_header TEXT DEFAULT 'MOTIVO: {motivo}',
    p_reminder_text TEXT DEFAULT ''
)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_webhook_url', COALESCE(p_webhook_url, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_webhook_role_ping', COALESCE(p_role_ping, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_bot_name', COALESCE(p_bot_name, 'INTERNAL AFFAIRS BUREAU'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_bot_avatar', COALESCE(p_bot_avatar, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_footer_text', COALESCE(p_footer_text, 'Internal Affairs Bureau • Régimen Disciplinario'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_custom_header', COALESCE(p_custom_header, 'MOTIVO: {motivo}'), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_sanctions_reminder_text', COALESCE(p_reminder_text, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC to get IA Sanction Banners
DROP FUNCTION IF EXISTS public.get_ia_sanction_banners();
CREATE OR REPLACE FUNCTION get_ia_sanction_banners()
RETURNS JSONB AS $$
DECLARE
    v_leves_sargentos TEXT;
    v_leves_ia TEXT;
    v_medias TEXT;
    v_graves TEXT;
    v_despido TEXT;
BEGIN
    SELECT value INTO v_leves_sargentos FROM public.app_settings WHERE key = 'discord_ia_banner_leves_sargentos';
    SELECT value INTO v_leves_ia FROM public.app_settings WHERE key = 'discord_ia_banner_leves_ia';
    SELECT value INTO v_medias FROM public.app_settings WHERE key = 'discord_ia_banner_medias';
    SELECT value INTO v_graves FROM public.app_settings WHERE key = 'discord_ia_banner_graves';
    SELECT value INTO v_despido FROM public.app_settings WHERE key = 'discord_ia_banner_despido';

    RETURN jsonb_build_object(
        'leves_sargentos', COALESCE(v_leves_sargentos, ''),
        'leves_ia', COALESCE(v_leves_ia, ''),
        'medias', COALESCE(v_medias, ''),
        'graves', COALESCE(v_graves, ''),
        'despido', COALESCE(v_despido, '')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC to save IA Sanction Banners
DROP FUNCTION IF EXISTS public.save_ia_sanction_banners(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_ia_sanction_banners(
    p_leves_sargentos TEXT DEFAULT '',
    p_leves_ia TEXT DEFAULT '',
    p_medias TEXT DEFAULT '',
    p_graves TEXT DEFAULT '',
    p_despido TEXT DEFAULT ''
)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_banner_leves_sargentos', COALESCE(p_leves_sargentos, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_banner_leves_ia', COALESCE(p_leves_ia, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_banner_medias', COALESCE(p_medias, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_banner_graves', COALESCE(p_graves, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('discord_ia_banner_despido', COALESCE(p_despido, ''), NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
