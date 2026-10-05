-- ==============================================================================
-- DIVISION PRESENTATION DISCORD WEBHOOKS (SEB, ASD, IA, COORDINATION)
-- Allows configuring institutional presentation announcements with photo and rich formatting.
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
        divisions::text ILIKE '%seb%' OR
        divisions::text ILIKE '%asd%' OR
        subdivisions::text ILIKE '%seb%' OR
        subdivisions::text ILIKE '%asd%' OR
        subdivisions::text ILIKE '%ia%' OR
        subdivisions::text ILIKE '%internal affairs%'
      )
    )
  );

GRANT ALL ON TABLE public.app_settings TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon;

-- 2. Insert default keys for Coordination Presentation
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_presentation_coordination_webhook_url', ''),
  ('discord_presentation_coordination_webhook_enabled', 'true'),
  ('discord_presentation_coordination_role_ping', ''),
  ('discord_presentation_coordination_bot_name', 'Sheriff Criminal Unit Bureau'),
  ('discord_presentation_coordination_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
  ('discord_presentation_coordination_title', '🕵️ SHERIFF CRIMINAL UNIT BUREAU'),
  ('discord_presentation_coordination_color', '#C5A059'),
  ('discord_presentation_coordination_image_url', ''),
  ('discord_presentation_coordination_footer', 'Los Santos County Sheriff''s Department • División de Investigaciones'),
  ('discord_presentation_coordination_description', 'La Sheriff Criminal Unit Bureau (SCUB) es la división especializada de investigaciones y operaciones encubiertas del Los Santos County Sheriff Department.

Integrada por detectives altamente capacitados, la SCUB coordina la investigación de delitos complejos, la gestión de escenas de crimen y la infiltración estratégica para desarticular redes criminales.

> La SCUB opera a través de dos unidades clave:
> • FOXTROT 📋 Agentes encargados de investigaciones visibles y patrullaje estratégico.
> • MIKE 🥸 Agentes en labores encubiertas, infiltración y operaciones críticas de alto riesgo.

*Nuestro objetivo es garantizar la justicia mediante el análisis exhaustivo, el cumplimiento de protocolos y el uso de tácticas avanzadas para mantener la seguridad en el condado.*

🔎 ACCESO A LA DIVISIÓN

El acceso a la SCUB es restringido y se realiza únicamente por invitación, basándose en los más altos estándares de mérito y compromiso.

> Requisitos generales:
> • Ostentar el rango de Deputy Sheriff o superior.
> • Poseer un historial impecable, sin investigaciones o sanciones activas del IAB.
> • Demostrar un alto nivel de compañerismo y habilidades de trabajo en equipo.

*En la SCUB, cada miembro es seleccionado para marcar la diferencia en la protección del condado y el cumplimiento de la ley.*')
ON CONFLICT (key) DO NOTHING;

-- 3. Insert default keys for SEB Presentation
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_presentation_seb_webhook_url', ''),
  ('discord_presentation_seb_webhook_enabled', 'true'),
  ('discord_presentation_seb_role_ping', ''),
  ('discord_presentation_seb_bot_name', 'SEB • Special Enforcement Bureau'),
  ('discord_presentation_seb_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
  ('discord_presentation_seb_title', '🦇 SPECIAL ENFORCEMENT BUREAU'),
  ('discord_presentation_seb_color', '#EAB308'),
  ('discord_presentation_seb_image_url', ''),
  ('discord_presentation_seb_footer', 'Los Santos County Sheriff''s Department • Tactical Enforcement'),
  ('discord_presentation_seb_description', 'El Special Enforcement Bureau (SEB) es la unidad táctica de intervención especial del Los Santos County Sheriff Department, diseñada para responder ante incidentes de máxima peligrosidad, barricadas, rescates de rehenes y operaciones de alto impacto.

Compuesta por operadores de élite, el SEB provee soporte táctico decisivo cuando las fuerzas ordinarias de patrullaje se ven superadas por situaciones hostiles.

> Unidades y escuadrones operativos de SEB:
> • CIRT ⚡ Critical Incident Response Team para asalto táctico coordinado.
> • K-9 🐕 Unidad canina especializada en rastreo, neutralización y detección de explosivos.
> • SNIPER 🎯 Operadores de precisión para reconocimiento y fuego de cobertura a larga distancia.

*Nuestra doctrina se fundamenta en la disciplina absoluta, la precisión táctica y la preservación prioritaria de la vida humana.*

🔎 ACCESO A LA DIVISIÓN

El ingreso al SEB es de máxima exigencia física, psicológica y operativa, reservado a los agentes con mayor templanza y capacitación.

> Requisitos generales:
> • Rango mínimo de Deputy Sheriff o superior en servicio activo.
> • Superar las pruebas de aptitud física, tiro de combate y estrés táctico.
> • Hoja de servicios sin sanciones disciplinarias activas ni investigaciones en curso.

*Fuerza, honor y resolución en la primera línea de defensa del condado.*')
ON CONFLICT (key) DO NOTHING;

-- 4. Insert default keys for ASD Presentation
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_presentation_asd_webhook_url', ''),
  ('discord_presentation_asd_webhook_enabled', 'true'),
  ('discord_presentation_asd_role_ping', ''),
  ('discord_presentation_asd_bot_name', 'ASD • Air Support Division'),
  ('discord_presentation_asd_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png'),
  ('discord_presentation_asd_title', '🚁 AIR SUPPORT DIVISION'),
  ('discord_presentation_asd_color', '#0284C7'),
  ('discord_presentation_asd_image_url', ''),
  ('discord_presentation_asd_footer', 'Los Santos County Sheriff''s Department • Tactical Airborne Law Enforcement'),
  ('discord_presentation_asd_description', 'La Air Support Division (ASD) es la división aeropolicial del Los Santos County Sheriff Department encargada de proporcionar soporte aéreo táctico, persecución visual, patrullaje preventivo y misiones de rescate en toda la geografía del condado.

Operando con helicópteros y aeronaves de última generación, la ASD actúa como el observador avanzado y multiplicador de fuerza para las unidades terrestres.

> Especialidades operativas de la ASD:
> • PATRULLAJE Y SEGUIMIENTO AÉREO 📡 Rastreo térmico nocturno (FLIR), localización y control de persecuciones.
> • APOYO TÁCTICO AIRBORNE 🪢 Despliegue e inserción rápida por rápel (Fast-Rope) y tiradores aéreos.
> • BÚSQUEDA Y RESCATE (SAR) 🌊 Operaciones de salvamento marítimo, rescates en montaña y evacuaciones médicas.

*Desde las alturas garantizamos una visión global para la seguridad y protección de cada oficial en el terreno.*

🔎 ACCESO A LA DIVISIÓN

El acceso a la ASD requiere superación del programa de habilitación aeronáutica y entrenamiento en cabina de mando.

> Requisitos generales:
> • Rango de Deputy Sheriff o superior en activo.
> • Obtener las licencias aeronáuticas oficiales requeridas y test de vuelo evaluado.
> • Excelente comunicación radial y conocimiento exhaustivo de la cuadrícula del condado.

*Ojos en el cielo, protección en la tierra.*')
ON CONFLICT (key) DO NOTHING;

-- 5. Insert default keys for IA Presentation
INSERT INTO public.app_settings (key, value)
VALUES 
  ('discord_presentation_ia_webhook_url', ''),
  ('discord_presentation_ia_webhook_enabled', 'true'),
  ('discord_presentation_ia_role_ping', ''),
  ('discord_presentation_ia_bot_name', 'Internal Affairs Bureau'),
  ('discord_presentation_ia_bot_avatar', 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/ia_logo.png'),
  ('discord_presentation_ia_title', '⚖️ INTERNAL AFFAIRS BUREAU'),
  ('discord_presentation_ia_color', '#E11D48'),
  ('discord_presentation_ia_image_url', ''),
  ('discord_presentation_ia_footer', 'Los Santos County Sheriff''s Department • Integridad Institucional'),
  ('discord_presentation_ia_description', 'El Internal Affairs Bureau (IAB) es el órgano independiente responsable de velar por la integridad, profesionalidad y ética de todos los integrantes del Los Santos County Sheriff Department.

Su encomienda es investigar de manera imparcial las denuncias ciudadanas, las faltas al código disciplinario y el uso irregular de la fuerza policial, salvaguardando la confianza pública.

> Áreas de investigación y supervisión:
> • DENUNCIAS Y QUEJAS PÚBLICAS 📂 Tramitación de denuncias externas e internas con estricta reserva.
> • AUDITORÍA Y PROCEDIMIENTOS 🔍 Inspección continuada de armamento, grabaciones y procedimientos operativos.
> • TRIBUNAL DISCIPLINARIO ⚖️ Tipificación de faltas leves, medias o graves y aplicación rigurosa de sanciones.

*Garantizamos que la ley y el respeto a los derechos se apliquen con la misma firmeza dentro del departamento que fuera de él.*

🔎 ACCESO A LA DIVISIÓN

La incorporación a Asuntos Internos es altamente restringida y se realiza únicamente mediante designación directa por Jefatura.

> Requisitos generales:
> • Trayectoria impecable y madurez profesional demostrada dentro del cuerpo.
> • Compromiso inquebrantable con la confidencialidad, la imparcialidad y la ética.
> • Evaluación favorable por parte de la Coordinación y Dirección del departamento.

*Integridad, rectitud y justicia sin concesiones.*')
ON CONFLICT (key) DO NOTHING;

-- 6. RPC to get Division Presentation Configuration
DROP FUNCTION IF EXISTS public.get_division_presentation_config(TEXT);
CREATE OR REPLACE FUNCTION get_division_presentation_config(p_division TEXT)
RETURNS JSONB AS $$
DECLARE
    v_div TEXT;
    v_url TEXT;
    v_enabled TEXT;
    v_role_ping TEXT;
    v_bot_name TEXT;
    v_bot_avatar TEXT;
    v_title TEXT;
    v_description TEXT;
    v_image_url TEXT;
    v_color TEXT;
    v_footer TEXT;
BEGIN
    v_div := LOWER(TRIM(COALESCE(p_division, 'coordination')));

    SELECT value INTO v_url FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_webhook_url';
    SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_webhook_enabled';
    SELECT value INTO v_role_ping FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_role_ping';
    SELECT value INTO v_bot_name FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_bot_name';
    SELECT value INTO v_bot_avatar FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_bot_avatar';
    SELECT value INTO v_title FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_title';
    SELECT value INTO v_description FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_description';
    SELECT value INTO v_image_url FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_image_url';
    SELECT value INTO v_color FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_color';
    SELECT value INTO v_footer FROM public.app_settings WHERE key = 'discord_presentation_' || v_div || '_footer';

    RETURN jsonb_build_object(
        'webhook_url', COALESCE(v_url, ''),
        'enabled', COALESCE(v_enabled, 'true') = 'true',
        'role_ping', COALESCE(v_role_ping, ''),
        'bot_name', v_bot_name,
        'bot_avatar', v_bot_avatar,
        'title', v_title,
        'description', v_description,
        'image_url', COALESCE(v_image_url, ''),
        'color', v_color,
        'footer', v_footer
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC to save Division Presentation Configuration
DROP FUNCTION IF EXISTS public.save_division_presentation_config(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION save_division_presentation_config(
    p_division TEXT,
    p_webhook_url TEXT DEFAULT '',
    p_title TEXT DEFAULT '',
    p_description TEXT DEFAULT '',
    p_image_url TEXT DEFAULT '',
    p_role_ping TEXT DEFAULT '',
    p_bot_name TEXT DEFAULT '',
    p_bot_avatar TEXT DEFAULT '',
    p_color TEXT DEFAULT '',
    p_footer TEXT DEFAULT '',
    p_enabled BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    v_div TEXT;
BEGIN
    v_div := LOWER(TRIM(COALESCE(p_division, 'coordination')));

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_webhook_url', COALESCE(p_webhook_url, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_title', COALESCE(p_title, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_description', COALESCE(p_description, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_image_url', COALESCE(p_image_url, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_role_ping', COALESCE(p_role_ping, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_bot_name', COALESCE(p_bot_name, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_bot_avatar', COALESCE(p_bot_avatar, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_color', COALESCE(p_color, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_footer', COALESCE(p_footer, ''), NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES ('discord_presentation_' || v_div || '_webhook_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END, NOW()) 
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'division', v_div);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
