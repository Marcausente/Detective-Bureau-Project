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
  ('branding_login_bg', '/logowebp/fondolssd.webp'),
  ('branding_gangs_nav_label', 'Bandas'),
  ('branding_gangs_title', 'Gangs & Narcotics Division'),
  ('branding_seb_nav_label', 'SEB'),
  ('branding_seb_badge', 'Special Enforcement Bureau'),
  ('branding_seb_title', 'División Operativa de Alto Riesgo'),
  ('branding_seb_subtitle', 'Tablón de operaciones y planificación táctica interactiva.'),
  ('branding_seb_logo', ''),
  ('branding_training_nav_label', 'Formación'),
  ('branding_training_title', 'Detective Training Program'),
  ('branding_training_subtitle', 'Departamento de Instrucción y Capacitación Continua'),
  ('branding_training_logo', '/logowebp/DTP logo.webp'),
  ('branding_ia_nav_label', 'Asuntos Internos'),
  ('branding_ia_badge', 'Sheriff Internal Affairs Division'),
  ('branding_ia_title', 'ASUNTOS INTERNOS'),
  ('branding_ia_logo', '/logowebp/IALSSD.webp'),
  ('branding_asd_nav_label', 'Air Support'),
  ('branding_asd_badge', 'ASD • S.C.U.B. / SAPD'),
  ('branding_asd_title', 'AIR SUPPORT DIVISION'),
  ('branding_asd_subtitle', 'Cuadrilla y Gestión Jerárquica de Vuelo, Habilitaciones e Infracciones de la División'),
  ('branding_asd_logo', ''),
  ('branding_undercover_nav_label', 'Undercover'),
  ('branding_undercover_title', 'SCUB Undercover Division'),
  ('branding_undercover_subtitle', 'Gestión de identidades encubiertas, leyendas de infiltración y aportes a Gang Unit'),
  ('branding_undercover_logo', ''),
  ('branding_ia_form_dept', 'LOS SANTOS COUNTY SHERIFF'),
  ('branding_ia_form_title', 'Registro de Denuncia Ciudadana'),
  ('branding_ia_form_badge', 'OFICIAL'),
  ('branding_ia_form_subtitle', 'Buzón Ciudadano de Quejas y Denuncias'),
  ('branding_ia_form_desc', 'Rellene los campos con los datos precisos sobre los hechos ocurridos. Todos los envíos son procesados de forma reservada.'),
  ('branding_ia_form_logo', '/logowebp/IALSSD.webp'),
  ('branding_map_title', 'SATÉLITE INTEL SAN ANDREAS'),
  ('branding_map_badge', 'SATÉLITE INTEL SAN ANDREAS'),
  ('branding_map_logo', ''),
  ('branding_public_map_title', 'MAPA DE ADVERTENCIA DE RIESGO'),
  ('branding_public_map_dept', 'Los Santos County Sheriff''s Department • Seguridad Pública'),
  ('branding_public_map_logo', '')
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
    v_gangs_nav_label TEXT;
    v_gangs_title TEXT;
    v_seb_nav_label TEXT;
    v_seb_badge TEXT;
    v_seb_title TEXT;
    v_seb_subtitle TEXT;
    v_seb_logo TEXT;
    v_training_nav_label TEXT;
    v_training_title TEXT;
    v_training_subtitle TEXT;
    v_training_logo TEXT;
    v_ia_nav_label TEXT;
    v_ia_badge TEXT;
    v_ia_title TEXT;
    v_ia_logo TEXT;
    v_asd_nav_label TEXT;
    v_asd_badge TEXT;
    v_asd_title TEXT;
    v_asd_subtitle TEXT;
    v_asd_logo TEXT;
    v_undercover_nav_label TEXT;
    v_undercover_title TEXT;
    v_undercover_subtitle TEXT;
    v_undercover_logo TEXT;
    v_ia_form_dept TEXT;
    v_ia_form_title TEXT;
    v_ia_form_badge TEXT;
    v_ia_form_subtitle TEXT;
    v_ia_form_desc TEXT;
    v_ia_form_logo TEXT;
    v_map_title TEXT;
    v_map_badge TEXT;
    v_map_logo TEXT;
    v_public_map_title TEXT;
    v_public_map_dept TEXT;
    v_public_map_logo TEXT;
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
    SELECT value INTO v_gangs_nav_label FROM public.app_settings WHERE key = 'branding_gangs_nav_label';
    SELECT value INTO v_gangs_title FROM public.app_settings WHERE key = 'branding_gangs_title';
    SELECT value INTO v_seb_nav_label FROM public.app_settings WHERE key = 'branding_seb_nav_label';
    SELECT value INTO v_seb_badge FROM public.app_settings WHERE key = 'branding_seb_badge';
    SELECT value INTO v_seb_title FROM public.app_settings WHERE key = 'branding_seb_title';
    SELECT value INTO v_seb_subtitle FROM public.app_settings WHERE key = 'branding_seb_subtitle';
    SELECT value INTO v_seb_logo FROM public.app_settings WHERE key = 'branding_seb_logo';
    SELECT value INTO v_training_nav_label FROM public.app_settings WHERE key = 'branding_training_nav_label';
    SELECT value INTO v_training_title FROM public.app_settings WHERE key = 'branding_training_title';
    SELECT value INTO v_training_subtitle FROM public.app_settings WHERE key = 'branding_training_subtitle';
    SELECT value INTO v_training_logo FROM public.app_settings WHERE key = 'branding_training_logo';
    SELECT value INTO v_ia_nav_label FROM public.app_settings WHERE key = 'branding_ia_nav_label';
    SELECT value INTO v_ia_badge FROM public.app_settings WHERE key = 'branding_ia_badge';
    SELECT value INTO v_ia_title FROM public.app_settings WHERE key = 'branding_ia_title';
    SELECT value INTO v_ia_logo FROM public.app_settings WHERE key = 'branding_ia_logo';
    SELECT value INTO v_asd_nav_label FROM public.app_settings WHERE key = 'branding_asd_nav_label';
    SELECT value INTO v_asd_badge FROM public.app_settings WHERE key = 'branding_asd_badge';
    SELECT value INTO v_asd_title FROM public.app_settings WHERE key = 'branding_asd_title';
    SELECT value INTO v_asd_subtitle FROM public.app_settings WHERE key = 'branding_asd_subtitle';
    SELECT value INTO v_asd_logo FROM public.app_settings WHERE key = 'branding_asd_logo';
    SELECT value INTO v_undercover_nav_label FROM public.app_settings WHERE key = 'branding_undercover_nav_label';
    SELECT value INTO v_undercover_title FROM public.app_settings WHERE key = 'branding_undercover_title';
    SELECT value INTO v_undercover_subtitle FROM public.app_settings WHERE key = 'branding_undercover_subtitle';
    SELECT value INTO v_undercover_logo FROM public.app_settings WHERE key = 'branding_undercover_logo';
    SELECT value INTO v_ia_form_dept FROM public.app_settings WHERE key = 'branding_ia_form_dept';
    SELECT value INTO v_ia_form_title FROM public.app_settings WHERE key = 'branding_ia_form_title';
    SELECT value INTO v_ia_form_badge FROM public.app_settings WHERE key = 'branding_ia_form_badge';
    SELECT value INTO v_ia_form_subtitle FROM public.app_settings WHERE key = 'branding_ia_form_subtitle';
    SELECT value INTO v_ia_form_desc FROM public.app_settings WHERE key = 'branding_ia_form_desc';
    SELECT value INTO v_ia_form_logo FROM public.app_settings WHERE key = 'branding_ia_form_logo';
    SELECT value INTO v_map_title FROM public.app_settings WHERE key = 'branding_map_title';
    SELECT value INTO v_map_badge FROM public.app_settings WHERE key = 'branding_map_badge';
    SELECT value INTO v_map_logo FROM public.app_settings WHERE key = 'branding_map_logo';
    SELECT value INTO v_public_map_title FROM public.app_settings WHERE key = 'branding_public_map_title';
    SELECT value INTO v_public_map_dept FROM public.app_settings WHERE key = 'branding_public_map_dept';
    SELECT value INTO v_public_map_logo FROM public.app_settings WHERE key = 'branding_public_map_logo';

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
        'login_bg', COALESCE(v_login_bg, '/logowebp/fondolssd.webp'),
        'gangs_nav_label', COALESCE(v_gangs_nav_label, 'Bandas'),
        'gangs_title', COALESCE(v_gangs_title, 'Gangs & Narcotics Division'),
        'seb_nav_label', COALESCE(v_seb_nav_label, 'SEB'),
        'seb_badge', COALESCE(v_seb_badge, 'Special Enforcement Bureau'),
        'seb_title', COALESCE(v_seb_title, 'División Operativa de Alto Riesgo'),
        'seb_subtitle', COALESCE(v_seb_subtitle, 'Tablón de operaciones y planificación táctica interactiva.'),
        'seb_logo', COALESCE(v_seb_logo, ''),
        'training_nav_label', COALESCE(v_training_nav_label, 'Formación'),
        'training_title', COALESCE(v_training_title, 'Detective Training Program'),
        'training_subtitle', COALESCE(v_training_subtitle, 'Departamento de Instrucción y Capacitación Continua'),
        'training_logo', COALESCE(v_training_logo, '/logowebp/DTP logo.webp'),
        'ia_nav_label', COALESCE(v_ia_nav_label, 'Asuntos Internos'),
        'ia_badge', COALESCE(v_ia_badge, 'Sheriff Internal Affairs Division'),
        'ia_title', COALESCE(v_ia_title, 'ASUNTOS INTERNOS'),
        'ia_logo', COALESCE(v_ia_logo, '/logowebp/IALSSD.webp'),
        'asd_nav_label', COALESCE(v_asd_nav_label, 'Air Support'),
        'asd_badge', COALESCE(v_asd_badge, 'ASD • S.C.U.B. / SAPD'),
        'asd_title', COALESCE(v_asd_title, 'AIR SUPPORT DIVISION'),
        'asd_subtitle', COALESCE(v_asd_subtitle, 'Cuadrilla y Gestión Jerárquica de Vuelo, Habilitaciones e Infracciones de la División'),
        'asd_logo', COALESCE(v_asd_logo, ''),
        'undercover_nav_label', COALESCE(v_undercover_nav_label, 'Undercover'),
        'undercover_title', COALESCE(v_undercover_title, 'SCUB Undercover Division'),
        'undercover_subtitle', COALESCE(v_undercover_subtitle, 'Gestión de identidades encubiertas, leyendas de infiltración y aportes a Gang Unit'),
        'undercover_logo', COALESCE(v_undercover_logo, ''),
        'ia_form_dept', COALESCE(v_ia_form_dept, 'LOS SANTOS COUNTY SHERIFF'),
        'ia_form_title', COALESCE(v_ia_form_title, 'Registro de Denuncia Ciudadana'),
        'ia_form_badge', COALESCE(v_ia_form_badge, 'OFICIAL'),
        'ia_form_subtitle', COALESCE(v_ia_form_subtitle, 'Buzón Ciudadano de Quejas y Denuncias'),
        'ia_form_desc', COALESCE(v_ia_form_desc, 'Rellene los campos con los datos precisos sobre los hechos ocurridos. Todos los envíos son procesados de forma reservada.'),
        'ia_form_logo', COALESCE(v_ia_form_logo, '/logowebp/IALSSD.webp'),
        'map_title', COALESCE(v_map_title, 'SATÉLITE INTEL SAN ANDREAS'),
        'map_badge', COALESCE(v_map_badge, 'SATÉLITE INTEL SAN ANDREAS'),
        'map_logo', COALESCE(v_map_logo, ''),
        'public_map_title', COALESCE(v_public_map_title, 'MAPA DE ADVERTENCIA DE RIESGO'),
        'public_map_dept', COALESCE(v_public_map_dept, 'Los Santos County Sheriff''s Department • Seguridad Pública'),
        'public_map_logo', COALESCE(v_public_map_logo, '')
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
