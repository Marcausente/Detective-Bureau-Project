
-- Delete Case Fully RPC
-- This function handles the cleanup of database records for a case.
-- Note: Image files in Storage must be deleted separately (e.g. from the client).

CREATE OR REPLACE FUNCTION delete_case_fully(p_case_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 1. Unlink interrogations (preserve the interrogation logs, just remove case link)
  UPDATE public.interrogations 
  SET case_id = NULL 
  WHERE case_id = p_case_id;

  -- 2. Delete assignments associated with the case
  DELETE FROM public.case_assignments 
  WHERE case_id = p_case_id;

  -- 3. Delete case updates (evidence/logs)
  DELETE FROM public.case_updates 
  WHERE case_id = p_case_id;

  -- 4. Finally, delete the case record
  DELETE FROM public.cases 
  WHERE id = p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
