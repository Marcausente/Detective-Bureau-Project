-- ==============================================================================
-- COMANDANCIA: DISCORD WEBHOOK PARA FEEDBACKS Y EMISIÓN DE FALTAS LEVES
-- ==============================================================================

-- 1. Insertar valores iniciales por defecto para el Webhook de Feedbacks en app_settings
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_feedback_webhook_url', ''),
  ('discord_feedback_webhook_enabled', 'false'),
  ('discord_feedback_webhook_role_ping', ''),
  ('discord_feedback_bot_name', 'Comandancia • Feedbacks LSPD'),
  ('discord_feedback_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/ia_logo.png'),
  ('discord_feedback_custom_msg', '📥 **NUEVO FEEDBACK REGISTRADO EN COMANDANCIA**')
ON CONFLICT (key) DO NOTHING;

-- 2. Asegurar permisos de lectura y escritura en app_settings para roles de Comandancia y autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO postgres, service_role;

-- 3. Asegurar permisos de ejecución de la RPC de Sanciones para usuarios autenticados
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'create_ia_published_sanction'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.create_ia_published_sanction TO authenticated;
    END IF;
END $$;

-- 4. Asegurar permisos en ia_published_sanctions
GRANT SELECT, INSERT, UPDATE ON TABLE public.ia_published_sanctions TO authenticated;
GRANT ALL ON TABLE public.ia_published_sanctions TO postgres, service_role;
