-- Fix Case Board Nodes User Deletion Constraint
-- This script updates the foreign key constraint 'case_board_nodes_created_by_fkey' to allow user deletion by setting created_by to NULL.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'case_board_nodes_created_by_fkey'
          AND table_name = 'case_board_nodes'
    ) THEN
        ALTER TABLE public.case_board_nodes DROP CONSTRAINT case_board_nodes_created_by_fkey;
    END IF;

    ALTER TABLE public.case_board_nodes 
    ADD CONSTRAINT case_board_nodes_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;
