-- ==============================================================================
-- DELETE DOJ CASE FULLY RPC
-- Permite eliminar permanentemente un caso/sumario del DOJ y limpiar de forma
-- segura todas sus dependencias (tareas, asignaciones, evidencias/actualizaciones)
-- desvinculando interrogatorios y sanciones para preservar sus historiales.
-- ==============================================================================

-- 1. Asegurar política RLS de DELETE en doj_cases
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'doj_cases' 
          AND policyname = 'Allow All Auth Delete DOJ Cases'
    ) THEN
        CREATE POLICY "Allow All Auth Delete DOJ Cases" ON public.doj_cases 
        FOR DELETE TO authenticated 
        USING (true);
    END IF;
END $$;

-- 2. Función RPC delete_doj_case_fully
DROP FUNCTION IF EXISTS public.delete_doj_case_fully(uuid);

CREATE OR REPLACE FUNCTION public.delete_doj_case_fully(p_case_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- 1. Desvincular interrogatorios asociados (conservar las actas, solo quitar la vinculación al caso)
  UPDATE public.doj_interrogations 
  SET case_id = NULL 
  WHERE case_id = p_case_id;

  -- 2. Desvincular sanciones asociadas (conservar las sanciones, solo quitar la vinculación al caso)
  UPDATE public.doj_sanctions
  SET case_id = NULL
  WHERE case_id = p_case_id;

  -- 3. Eliminar tareas / diligencias del sistema de To-Do del caso
  DELETE FROM public.doj_case_todos
  WHERE category_id IN (
    SELECT id FROM public.doj_case_todo_categories WHERE case_id = p_case_id
  );

  DELETE FROM public.doj_case_todo_categories
  WHERE case_id = p_case_id;

  -- 4. Eliminar asignaciones de agentes al caso
  DELETE FROM public.doj_case_assignments 
  WHERE case_id = p_case_id;

  -- 5. Eliminar actualizaciones, bitácoras y evidencias del caso
  DELETE FROM public.doj_case_updates 
  WHERE case_id = p_case_id;

  -- 6. Finalmente, eliminar el expediente del caso en doj_cases
  DELETE FROM public.doj_cases 
  WHERE id = p_case_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RETURN 'SUCCESS';
  ELSE
    RETURN 'NOT_FOUND';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_doj_case_fully(UUID) TO authenticated, service_role;
