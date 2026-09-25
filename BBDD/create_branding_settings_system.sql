-- ==============================================================================
-- APP BRANDING & WHITE-LABEL CUSTOMIZATION SYSTEM
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
        rol::text ILIKE '%comisionado%'
      )
    )
  );

GRANT ALL ON TABLE public.app_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon;

-- 2. Insert default keys for Application Branding
INSERT INTO public.app_settings (key, value)
VALUES 
  ('branding_topbar_name', 'SCUB'),
  ('branding_topbar_logo', '/logowebp/SCUB.webp'),
  ('branding_app_title', 'Sheriff Criminal Unit Bureau'),
  ('branding_app_favicon', '/logowebp/SCUB.webp'),
  ('branding_dashboard_title', 'SHERIFF CRIMINAL UNIT'),
  ('branding_dashboard_subtitle', 'Sheriff Criminal Unit Bureau'),
  ('branding_cases_title', 'GENERAL CRIMES DIVISION'),
  ('branding_cases_subtitle', 'Sheriff Criminal Unit Bureau'),
  ('branding_cases_logo', '/logowebp/Generalcrimes.webp'),
  ('branding_complaints_title', 'Registro de Denuncias'),
  ('branding_complaints_logo', '/logowebp/Generalcrimes.webp'),
  ('branding_login_dept', 'Los Santos Sheriff''s Department'),
  ('branding_login_bureau', 'Sheriff Criminal Unit Bureau'),
  ('branding_login_logo', '/logowebp/SCUB.webp'),
  ('branding_login_bg', '/logowebp/fondolssd.webp')
ON CONFLICT (key) DO NOTHING;

-- 3. RPC to get Branding Settings
DROP FUNCTION IF EXISTS public.get_app_branding();
CREATE OR REPLACE FUNCTION get_app_branding()
RETURNS JSONB AS $$
DECLARE
    v_topbar_name TEXT;
    v_topbar_logo TEXT;
    v_app_title TEXT;
    v_app_favicon TEXT;
    v_dashboard_title TEXT;
    v_dashboard_subtitle TEXT;
    v_cases_title TEXT;
    v_cases_subtitle TEXT;
    v_cases_logo TEXT;
    v_complaints_title TEXT;
    v_complaints_logo TEXT;
    v_login_dept TEXT;
    v_login_bureau TEXT;
    v_login_logo TEXT;
    v_login_bg TEXT;
BEGIN
    SELECT value INTO v_topbar_name FROM public.app_settings WHERE key = 'branding_topbar_name';
    SELECT value INTO v_topbar_logo FROM public.app_settings WHERE key = 'branding_topbar_logo';
    SELECT value INTO v_app_title FROM public.app_settings WHERE key = 'branding_app_title';
    SELECT value INTO v_app_favicon FROM public.app_settings WHERE key = 'branding_app_favicon';
    SELECT value INTO v_dashboard_title FROM public.app_settings WHERE key = 'branding_dashboard_title';
    SELECT value INTO v_dashboard_subtitle FROM public.app_settings WHERE key = 'branding_dashboard_subtitle';
    SELECT value INTO v_cases_title FROM public.app_settings WHERE key = 'branding_cases_title';
    SELECT value INTO v_cases_subtitle FROM public.app_settings WHERE key = 'branding_cases_subtitle';
    SELECT value INTO v_cases_logo FROM public.app_settings WHERE key = 'branding_cases_logo';
    SELECT value INTO v_complaints_title FROM public.app_settings WHERE key = 'branding_complaints_title';
    SELECT value INTO v_complaints_logo FROM public.app_settings WHERE key = 'branding_complaints_logo';
    SELECT value INTO v_login_dept FROM public.app_settings WHERE key = 'branding_login_dept';
    SELECT value INTO v_login_bureau FROM public.app_settings WHERE key = 'branding_login_bureau';
    SELECT value INTO v_login_logo FROM public.app_settings WHERE key = 'branding_login_logo';
    SELECT value INTO v_login_bg FROM public.app_settings WHERE key = 'branding_login_bg';

    RETURN jsonb_build_object(
        'topbar_name', COALESCE(v_topbar_name, 'SCUB'),
        'topbar_logo', COALESCE(v_topbar_logo, '/logowebp/SCUB.webp'),
        'app_title', COALESCE(v_app_title, 'Sheriff Criminal Unit Bureau'),
        'app_favicon', COALESCE(v_app_favicon, '/logowebp/SCUB.webp'),
        'dashboard_title', COALESCE(v_dashboard_title, 'SHERIFF CRIMINAL UNIT'),
        'dashboard_subtitle', COALESCE(v_dashboard_subtitle, 'Sheriff Criminal Unit Bureau'),
        'cases_title', COALESCE(v_cases_title, 'GENERAL CRIMES DIVISION'),
        'cases_subtitle', COALESCE(v_cases_subtitle, 'Sheriff Criminal Unit Bureau'),
        'cases_logo', COALESCE(v_cases_logo, '/logowebp/Generalcrimes.webp'),
        'complaints_title', COALESCE(v_complaints_title, 'Registro de Denuncias'),
        'complaints_logo', COALESCE(v_complaints_logo, '/logowebp/Generalcrimes.webp'),
        'login_dept', COALESCE(v_login_dept, 'Los Santos Sheriff''s Department'),
        'login_bureau', COALESCE(v_login_bureau, 'Sheriff Criminal Unit Bureau'),
        'login_logo', COALESCE(v_login_logo, '/logowebp/SCUB.webp'),
        'login_bg', COALESCE(v_login_bg, '/logowebp/fondolssd.webp')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC to save Branding Settings
DROP FUNCTION IF EXISTS public.save_app_branding(JSONB);
CREATE OR REPLACE FUNCTION save_app_branding(p_config JSONB)
RETURNS JSONB AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT key, value FROM jsonb_each_text(p_config)
    LOOP
        INSERT INTO public.app_settings (key, value, updated_at)
        VALUES ('branding_' || r.key, r.value, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
