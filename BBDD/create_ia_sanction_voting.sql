-- ========================================================
-- INTERNAL AFFAIRS CASE SANCTION VOTING SYSTEM
-- ========================================================

-- 1. Tabla de personas/investigados cuyo caso se votará
CREATE TABLE IF NOT EXISTS public.ia_case_sanction_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.ia_cases(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 2. Tabla de opciones de sanciones propuestas para cada persona
CREATE TABLE IF NOT EXISTS public.ia_case_sanction_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.ia_case_sanction_targets(id) ON DELETE CASCADE,
  sanction_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de votos emitidos por el personal de Asuntos Internos
CREATE TABLE IF NOT EXISTS public.ia_case_sanction_votes (
  target_id UUID NOT NULL REFERENCES public.ia_case_sanction_targets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.ia_case_sanction_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (target_id, user_id)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.ia_case_sanction_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_case_sanction_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_case_sanction_votes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para ia_case_sanction_targets
CREATE POLICY "Allow All Auth Read IA Sanction Targets" ON public.ia_case_sanction_targets 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow All Auth Write IA Sanction Targets" ON public.ia_case_sanction_targets 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas de RLS para ia_case_sanction_options
CREATE POLICY "Allow All Auth Read IA Sanction Options" ON public.ia_case_sanction_options 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow All Auth Write IA Sanction Options" ON public.ia_case_sanction_options 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas de RLS para ia_case_sanction_votes
CREATE POLICY "Allow All Auth Read IA Sanction Votes" ON public.ia_case_sanction_votes 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow All Auth Write IA Sanction Votes" ON public.ia_case_sanction_votes 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
