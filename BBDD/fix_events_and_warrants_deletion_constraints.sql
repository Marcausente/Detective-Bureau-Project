-- Fix User Deletion FK Constraints for Events and Warrant Requests
-- This script updates foreign key constraints to allow user deletion by setting references to NULL.
-- It safely checks for table existence to avoid failures.

-- 1. events (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'events_created_by_fkey') THEN
            ALTER TABLE public.events DROP CONSTRAINT events_created_by_fkey;
        END IF;

        ALTER TABLE public.events 
        ADD CONSTRAINT events_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. warrant_requests (requested_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warrant_requests') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'warrant_requests_requested_by_fkey') THEN
            ALTER TABLE public.warrant_requests DROP CONSTRAINT warrant_requests_requested_by_fkey;
        END IF;

        ALTER TABLE public.warrant_requests 
        ADD CONSTRAINT warrant_requests_requested_by_fkey 
        FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. warrant_requests (reviewed_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warrant_requests') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'warrant_requests_reviewed_by_fkey') THEN
            ALTER TABLE public.warrant_requests DROP CONSTRAINT warrant_requests_reviewed_by_fkey;
        END IF;

        ALTER TABLE public.warrant_requests 
        ADD CONSTRAINT warrant_requests_reviewed_by_fkey 
        FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

