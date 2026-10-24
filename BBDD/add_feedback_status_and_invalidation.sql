-- ==============================================================================
-- SISTEMA DE GESTIÓN, BORRADO E INVALIDACIÓN DE FEEDBACKS EN COMANDANCIA
-- 1. Añade columna status a agent_feedbacks (por defecto 'Activo')
-- 2. Permite a los mandos marcar feedbacks como 'Invalido' o eliminarlos
-- 3. Actualiza get_feedback_fichas() para excluir feedbacks con status = 'Invalido'
-- ==============================================================================

-- 1. Asegurar columna status
ALTER TABLE public.agent_feedbacks 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Activo';

-- 2. Asegurar índice para filtrado rápido por estado
CREATE INDEX IF NOT EXISTS idx_agent_feedbacks_status 
ON public.agent_feedbacks (status);

-- 3. Permitir actualización y eliminación a usuarios autenticados
DROP POLICY IF EXISTS "Allow auth update feedback" ON public.agent_feedbacks;
CREATE POLICY "Allow auth update feedback" 
  ON public.agent_feedbacks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow auth delete feedback" ON public.agent_feedbacks;
CREATE POLICY "Allow auth delete feedback" 
  ON public.agent_feedbacks FOR DELETE
  TO authenticated
  USING (true);

-- 4. Actualizar función RPC get_feedback_fichas para excluir inválidos
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
    AND (af.status IS NULL OR af.status != 'Invalido')
  GROUP BY TRIM(af.target_name)
  ORDER BY TRIM(af.target_name) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_feedback_fichas() TO anon, authenticated, service_role;
