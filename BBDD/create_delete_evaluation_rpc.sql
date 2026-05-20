-- 1. Create a function to delete evaluations securely
CREATE OR REPLACE FUNCTION delete_evaluation(p_evaluation_id UUID)
RETURNS VOID AS $$
DECLARE
  v_viewer_id UUID;
  v_viewer_rank app_rank;
  v_target_user_id UUID;
  v_target_user_rank app_rank;
BEGIN
  v_viewer_id := auth.uid();

  -- Get Viewer Rank
  SELECT rango INTO v_viewer_rank FROM public.users WHERE id = v_viewer_id;

  -- Get Target User ID and Rank from the evaluation
  SELECT e.target_user_id, u.rango 
  INTO v_target_user_id, v_target_user_rank
  FROM public.evaluations e
  JOIN public.users u ON e.target_user_id = u.id
  WHERE e.id = p_evaluation_id;

  -- Verify existence
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Evaluation not found';
  END IF;

  -- Perform the same check as the frontend (Viewer > Target in rank hierarchy)
  IF public.check_evaluation_access(v_viewer_id, v_target_user_id) THEN
     DELETE FROM public.evaluations WHERE id = p_evaluation_id;
  ELSE
     RAISE EXCEPTION 'Access Denied: You do not have sufficient rank to delete this evaluation.';
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
