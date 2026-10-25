-- ========================================================
-- Actualización de Configuración de Branding: Pantalla de Login
-- ========================================================

-- Asegurar que los campos del Login existen con valores iniciales
INSERT INTO public.app_settings (key, value, updated_at)
VALUES 
    ('branding_login_window_title', 'Terminal de Autenticación Rápida', NOW()),
    ('branding_login_card_title', 'Autenticación de Agente', NOW()),
    ('branding_login_card_subtitle', 'Identifícate con tus credenciales asignadas', NOW()),
    ('branding_login_card_logo', '/logowebp/SCUB.webp', NOW()),
    ('branding_login_header_logo_left', '/logowebp/LSSDlogo.webp', NOW()),
    ('branding_login_header_logo_right', '/logowebp/SCUB.webp', NOW()),
    ('branding_login_email_placeholder', 'agente@lssd.com', NOW()),
    ('branding_login_button_text', 'Acceder al Sistema', NOW()),
    ('branding_login_footer', 'Sheriff Criminal Unit Bureau • Sistema Encifrado y Monitoreado', NOW())
ON CONFLICT (key) DO NOTHING;
