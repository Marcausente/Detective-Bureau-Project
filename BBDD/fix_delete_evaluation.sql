-- 1. Helper Function: Get Numeric Rank Level
CREATE OR REPLACE FUNCTION public.get_rank_level(r app_rank) RETURNS INTEGER AS $$
BEGIN
    RETURN CASE r
        WHEN 'Deputy Sheriff' THEN 10
        WHEN 'Oficial I' THEN 15
        WHEN 'Deputy Sheriff Bonus I' THEN 20
        WHEN 'Oficial II' THEN 30
        WHEN 'Deputy Sheriff Bonus II' THEN 35
        WHEN 'Oficial III' THEN 40
        WHEN 'Oficial III+' THEN 50
        WHEN 'Detective I' THEN 60
        WHEN 'Detective II' THEN 70
        WHEN 'Detective III' THEN 80
        WHEN 'Internal Affairs Agent' THEN 85
        WHEN 'Department of Justice Agent' THEN 85
        WHEN 'Teniente' THEN 90
        WHEN 'Capitan' THEN 100
        WHEN 'Comandante' THEN 110
        WHEN 'Division Chief' THEN 120
        WHEN 'Assistant Sheriff' THEN 130
        WHEN 'Undersheriff' THEN 140
        WHEN 'Sheriff' THEN 150
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Check Access Function
CREATE OR REPLACE FUNCTION public.check_evaluation_access(viewer_id UUID, target_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    viewer_rank app_rank;
    target_rank app_rank;
BEGIN
    -- Get ranks
    SELECT rango INTO viewer_rank FROM public.users WHERE id = viewer_id;
    SELECT rango INTO target_rank FROM public.users WHERE id = target_id;

    IF viewer_rank IS NULL OR target_rank IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Logic: Viewer must be STRICTLY HIGHER than Target
    RETURN public.get_rank_level(viewer_rank) > public.get_rank_level(target_rank);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update delete_evaluation RPC
CREATE OR REPLACE FUNCTION public.delete_evaluation(p_evaluation_id UUID)
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

  -- Only Detective I or higher (level 60+) can delete evaluations
  IF public.get_rank_level(v_viewer_rank) < 60 THEN
    RAISE EXCEPTION 'Access Denied: Only Detective I or higher can delete evaluations.';
  END IF;

  -- Perform the same check as the frontend (Viewer > Target in rank hierarchy)
  IF public.check_evaluation_access(v_viewer_id, v_target_user_id) THEN
     DELETE FROM public.evaluations WHERE id = p_evaluation_id;
  ELSE
     RAISE EXCEPTION 'Access Denied: You do not have sufficient rank to delete this evaluation.';
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
