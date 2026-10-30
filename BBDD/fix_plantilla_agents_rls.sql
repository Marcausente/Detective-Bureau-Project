-- ==============================================================================
-- FIX RLS POLICIES FOR PLANTILLA DE AGENTES (LSSD / LSPD)
-- Permite que los usuarios con clave anon y authenticated puedan leer, insertar,
-- actualizar y eliminar registros en las tablas dedicadas de la plantilla.
-- ==============================================================================

-- 1. Rangos de Plantilla
ALTER TABLE public.plantilla_ranks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read plantilla_ranks" ON public.plantilla_ranks;
DROP POLICY IF EXISTS "Allow manage plantilla_ranks" ON public.plantilla_ranks;
DROP POLICY IF EXISTS "Allow all for anon and auth plantilla_ranks" ON public.plantilla_ranks;

CREATE POLICY "Allow all for anon and auth plantilla_ranks" 
ON public.plantilla_ranks
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

GRANT ALL ON TABLE public.plantilla_ranks TO anon, authenticated, service_role, postgres;

-- 2. Divisiones de Plantilla
ALTER TABLE public.plantilla_divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read plantilla_divisions" ON public.plantilla_divisions;
DROP POLICY IF EXISTS "Allow manage plantilla_divisions" ON public.plantilla_divisions;
DROP POLICY IF EXISTS "Allow all for anon and auth plantilla_divisions" ON public.plantilla_divisions;

CREATE POLICY "Allow all for anon and auth plantilla_divisions" 
ON public.plantilla_divisions
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

GRANT ALL ON TABLE public.plantilla_divisions TO anon, authenticated, service_role, postgres;

-- 3. Agentes de Plantilla
ALTER TABLE public.plantilla_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read plantilla_agents" ON public.plantilla_agents;
DROP POLICY IF EXISTS "Allow manage plantilla_agents" ON public.plantilla_agents;
DROP POLICY IF EXISTS "Allow all for anon and auth plantilla_agents" ON public.plantilla_agents;

CREATE POLICY "Allow all for anon and auth plantilla_agents" 
ON public.plantilla_agents
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

GRANT ALL ON TABLE public.plantilla_agents TO anon, authenticated, service_role, postgres;

