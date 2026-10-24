-- ==============================================================================
-- SISTEMA DE FICHAS EVALUATIVAS Y AUTOCOMPLETADO DE AGENTES
-- 1. Permite autocompletar nombres de agentes que ya tengan "Ficha" creada.
-- 2. Si un agente no tiene ficha previa, se crea automáticamente al enviar el informe.
-- 3. Función pública accesible sin login para consultar las fichas existentes.
-- ==============================================================================

-- 1. Asegurar que target_name tenga índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_agent_feedbacks_target_name_lower 
ON public.agent_feedbacks (LOWER(TRIM(target_name)));

-- 2. Función para obtener fichas evaluativas existentes (Acceso público sin login)
CREATE OR REPLACE FUNCTION public.get_feedback_fichas()
RETURNS TABLE (
  agent_name TEXT,
  feedbacks_count BIGINT,
  positives_count BIGINT,
  negatives_count BIGINT,
  mixed_count BIGINT,
  last_feedback DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRIM(af.target_name) AS agent_name,
    COUNT(*)::BIGINT AS feedbacks_count,
    COUNT(*) FILTER (WHERE af.tipo = 'Positivo')::BIGINT AS positives_count,
    COUNT(*) FILTER (WHERE af.tipo = 'Negativo')::BIGINT AS negatives_count,
    COUNT(*) FILTER (WHERE af.tipo = 'Mixto')::BIGINT AS mixed_count,
    MAX(af.fecha)::DATE AS last_feedback
  FROM public.agent_feedbacks af
  WHERE af.target_name IS NOT NULL 
    AND TRIM(af.target_name) != ''
  GROUP BY TRIM(af.target_name)
  ORDER BY TRIM(af.target_name) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Otorgar permisos de ejecución a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.get_feedback_fichas() TO anon, authenticated, service_role;

-- 4. Asegurar política de inserción pública sin restricciones para el formulario
DROP POLICY IF EXISTS "Allow anon and auth insert feedback" ON public.agent_feedbacks;
CREATE POLICY "Allow anon and auth insert feedback"
  ON public.agent_feedbacks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. Permitir lectura anónima y autenticada de feedbacks para visualización y autocomplete
DROP POLICY IF EXISTS "Allow anon and auth read feedback" ON public.agent_feedbacks;
DROP POLICY IF EXISTS "Allow authenticated read feedback" ON public.agent_feedbacks;
CREATE POLICY "Allow anon and auth read feedback"
  ON public.agent_feedbacks FOR SELECT
  TO anon, authenticated
  USING (true);
