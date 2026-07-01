-- 1. Update Status for IA Cases
CREATE OR REPLACE FUNCTION set_ia_case_status(p_case_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ia_cases 
  SET status = p_status 
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Delete IA Case Fully
CREATE OR REPLACE FUNCTION delete_ia_case_fully(p_case_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Unlink linked complaints (return to receptor-denuncias as 'Incoming')
  UPDATE public.ia_complaints
  SET case_id = NULL, status = 'Incoming'
  WHERE case_id = p_case_id;

  -- Unlink linked interrogations
  UPDATE public.ia_interrogations
  SET case_id = NULL
  WHERE case_id = p_case_id;

  -- Delete case assignments
  DELETE FROM public.ia_case_assignments 
  WHERE case_id = p_case_id;

  -- Delete case updates (evidence/logs)
  DELETE FROM public.ia_case_updates 
  WHERE case_id = p_case_id;

  -- Delete from ia_case_todo_categories
  DELETE FROM public.ia_case_todo_categories
  WHERE case_id = p_case_id;

  -- Finally, delete the case record
  DELETE FROM public.ia_cases 
  WHERE id = p_case_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RETURN 'SUCCESS';
  ELSE
    RETURN 'NOT_FOUND';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
