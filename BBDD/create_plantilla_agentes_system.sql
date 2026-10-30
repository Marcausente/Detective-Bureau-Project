-- ==============================================================================
-- PLANTILLA DE AGENTES - COMANDANCIA LSSD / LSPD
-- Sistema de gestión de personal, jerarquía de rangos, divisiones, analíticas y vinculación con IA
-- ==============================================================================

-- 1. Tabla de Rangos de la Plantilla (con jerarquía e insignia)
CREATE TABLE IF NOT EXISTS public.plantilla_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    badge_image_url TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Divisiones de la Plantilla (con icono / insignia)
CREATE TABLE IF NOT EXISTS public.plantilla_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    short_name TEXT DEFAULT '',
    badge_image_url TEXT DEFAULT '',
    color TEXT DEFAULT '#10b981',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla Principal de Agentes de la Plantilla
CREATE TABLE IF NOT EXISTS public.plantilla_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    username TEXT DEFAULT '',
    email TEXT DEFAULT '',
    nombre TEXT DEFAULT '',
    apellido TEXT DEFAULT '',
    no_placa TEXT DEFAULT '',
    rank_id UUID REFERENCES public.plantilla_ranks(id) ON DELETE SET NULL,
    rank_name TEXT DEFAULT '',
    divisions TEXT[] DEFAULT '{}',
    activity_status TEXT DEFAULT 'Activo', -- 'Activo', 'Poco activa', 'Inactivo'
    last_promotion_date DATE DEFAULT NULL,
    notes TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_placeholder BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Añadir columna de vinculación en ia_subject_profiles si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ia_subject_profiles' 
        AND column_name = 'plantilla_agent_id'
    ) THEN
        ALTER TABLE public.ia_subject_profiles 
        ADD COLUMN plantilla_agent_id UUID REFERENCES public.plantilla_agents(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ia_subject_profiles_plantilla_agent 
ON public.ia_subject_profiles(plantilla_agent_id);

-- 5. Habilitar RLS
ALTER TABLE public.plantilla_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantilla_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantilla_agents ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Seguridad (Lectura para autenticados, Escritura para Comandancia / autenticados)
DROP POLICY IF EXISTS "Allow read plantilla_ranks" ON public.plantilla_ranks;
CREATE POLICY "Allow read plantilla_ranks" ON public.plantilla_ranks 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manage plantilla_ranks" ON public.plantilla_ranks;
CREATE POLICY "Allow manage plantilla_ranks" ON public.plantilla_ranks 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read plantilla_divisions" ON public.plantilla_divisions;
CREATE POLICY "Allow read plantilla_divisions" ON public.plantilla_divisions 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manage plantilla_divisions" ON public.plantilla_divisions;
CREATE POLICY "Allow manage plantilla_divisions" ON public.plantilla_divisions 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read plantilla_agents" ON public.plantilla_agents;
CREATE POLICY "Allow read plantilla_agents" ON public.plantilla_agents 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manage plantilla_agents" ON public.plantilla_agents;
CREATE POLICY "Allow manage plantilla_agents" ON public.plantilla_agents 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Otorgar permisos
GRANT ALL ON TABLE public.plantilla_ranks TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.plantilla_divisions TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.plantilla_agents TO postgres, service_role, authenticated;

-- 7. Inserción de Rangos Iniciales por Defecto (si la tabla está vacía)
INSERT INTO public.plantilla_ranks (name, category, order_index, color)
SELECT * FROM (VALUES
    ('14. Sheriff', 'JEFATURA SHERIFF', 1, '#eab308'),
    ('13. Sheriff Adjunto', 'JEFATURA SHERIFF', 2, '#eab308'),
    ('12. Sheriff Asistente', 'JEFATURA SHERIFF', 3, '#ca8a04'),
    ('11. Division Chief', 'JEFATURA SHERIFF', 4, '#ca8a04'),
    ('10. Comandante', 'JEFATURA SHERIFF', 5, '#a16207'),
    ('09. Capitán', 'COMMAND', 6, '#3b82f6'),
    ('08. Teniente', 'COMMAND', 7, '#60a5fa'),
    ('09. Sargento II', 'SARGEANTS', 8, '#10b981'),
    ('07. Sargento', 'SARGEANTS', 9, '#34d399'),
    ('10. Detective III', 'DETECTIVES', 10, '#8b5cf6'),
    ('09. Detective II', 'DETECTIVES', 11, '#a78bfa'),
    ('08. Detective I', 'DETECTIVES', 12, '#c4b5fd'),
    ('Oficial Master FTO', 'ESCALA BÁSICA', 13, '#06b6d4'),
    ('Deputy Sheriff Bonus II', 'ESCALA BÁSICA', 14, '#0ea5e9'),
    ('Deputy Sheriff Bonus I', 'ESCALA BÁSICA', 15, '#38bdf8'),
    ('Deputy Sheriff', 'ESCALA BÁSICA', 16, '#93c5fd'),
    ('DS Trainee', 'ESCALA BÁSICA', 17, '#94a3b8')
) AS v(name, category, order_index, color)
WHERE NOT EXISTS (SELECT 1 FROM public.plantilla_ranks);

-- 8. Inserción de Divisiones Iniciales por Defecto (si la tabla está vacía)
INSERT INTO public.plantilla_divisions (name, short_name, order_index, color)
SELECT * FROM (VALUES
    ('TRT / SEB', 'TRT', 1, '#15803d'),
    ('SCUB', 'SCUB', 2, '#0284c7'),
    ('IAB', 'IAB', 3, '#b91c1c'),
    ('ASD', 'ASD', 4, '#4338ca'),
    ('RTB', 'RTB', 5, '#d97706'),
    ('SAHP', 'SAHP', 6, '#ea580c'),
    ('SIB', 'SIB', 7, '#7c3aed'),
    ('USMS', 'USMS', 8, '#0369a1'),
    ('DOJ', 'DOJ', 9, '#475569'),
    ('K9', 'K9', 10, '#047857'),
    ('RANGER', 'RANGER', 11, '#166534'),
    ('PIA', 'PIA', 12, '#9333ea'),
    ('SMD', 'SMD', 13, '#be123c')
) AS v(name, short_name, order_index, color)
WHERE NOT EXISTS (SELECT 1 FROM public.plantilla_divisions);

