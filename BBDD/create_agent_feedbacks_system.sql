-- ==============================================================================
-- SISTEMA DE FEEDBACKS DE AGENTES
-- Formulario público sin login + Gestión en Comandancia + Historial en Personal
-- ==============================================================================

-- 1. Crear tabla de feedbacks de agentes
CREATE TABLE IF NOT EXISTS public.agent_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('Positivo', 'Negativo', 'Mixto')),
    author_name TEXT NOT NULL,
    author_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    target_name TEXT NOT NULL,
    target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índices para agilizar consultas
CREATE INDEX IF NOT EXISTS idx_agent_feedbacks_target_user_id ON public.agent_feedbacks(target_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedbacks_author_user_id ON public.agent_feedbacks(author_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedbacks_tipo ON public.agent_feedbacks(tipo);

-- 3. Habilitar RLS
ALTER TABLE public.agent_feedbacks ENABLE ROW LEVEL SECURITY;

-- 4. Permitir INSERT anónimo y autenticado (para formulario público sin login)
DROP POLICY IF EXISTS "Allow anon and auth insert feedback" ON public.agent_feedbacks;
CREATE POLICY "Allow anon and auth insert feedback"
  ON public.agent_feedbacks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. Permitir lectura a usuarios autenticados
DROP POLICY IF EXISTS "Allow authenticated read feedback" ON public.agent_feedbacks;
CREATE POLICY "Allow authenticated read feedback"
  ON public.agent_feedbacks FOR SELECT
  TO authenticated
  USING (true);

-- 6. Permitir gestión (UPDATE/DELETE) a Comandancia, Comisionado y Administradores
DROP POLICY IF EXISTS "Allow manage feedbacks" ON public.agent_feedbacks;
CREATE POLICY "Allow manage feedbacks"
  ON public.agent_feedbacks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND (
        public.users.rol::text IN ('Comisionado', 'Administrador')
        OR (public.users.divisions IS NOT NULL AND 'Comandancia' = ANY(public.users.divisions))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND (
        public.users.rol::text IN ('Comisionado', 'Administrador')
        OR (public.users.divisions IS NOT NULL AND 'Comandancia' = ANY(public.users.divisions))
      )
    )
  );

GRANT ALL ON public.agent_feedbacks TO anon, authenticated, service_role;
