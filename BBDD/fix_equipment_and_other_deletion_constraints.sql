-- Fix Remaining User Deletion FK Constraints
-- This script updates foreign key constraints for equipment, DOJ, and IA systems to allow user deletion by setting references to NULL.

-- 1. equipment_types (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'equipment_types_created_by_fkey') THEN
        ALTER TABLE public.equipment_types DROP CONSTRAINT equipment_types_created_by_fkey;
    END IF;
    
    ALTER TABLE public.equipment_types 
    ADD CONSTRAINT equipment_types_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 2. personnel_equipment (issued_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'personnel_equipment_issued_by_fkey') THEN
        ALTER TABLE public.personnel_equipment DROP CONSTRAINT personnel_equipment_issued_by_fkey;
    END IF;
    
    ALTER TABLE public.personnel_equipment 
    ADD CONSTRAINT personnel_equipment_issued_by_fkey 
    FOREIGN KEY (issued_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 3. doj_license_types (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_license_types_created_by_fkey') THEN
        ALTER TABLE public.doj_license_types DROP CONSTRAINT doj_license_types_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_license_types 
    ADD CONSTRAINT doj_license_types_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 4. doj_civilian_profiles (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_civilian_profiles_created_by_fkey') THEN
        ALTER TABLE public.doj_civilian_profiles DROP CONSTRAINT doj_civilian_profiles_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_civilian_profiles 
    ADD CONSTRAINT doj_civilian_profiles_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 5. doj_civilian_licenses (issued_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_civilian_licenses_issued_by_fkey') THEN
        ALTER TABLE public.doj_civilian_licenses DROP CONSTRAINT doj_civilian_licenses_issued_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_civilian_licenses 
    ADD CONSTRAINT doj_civilian_licenses_issued_by_fkey 
    FOREIGN KEY (issued_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 6. doj_subject_profiles (created_by & linked_user_id) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_subject_profiles_created_by_fkey') THEN
        ALTER TABLE public.doj_subject_profiles DROP CONSTRAINT doj_subject_profiles_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_subject_profiles 
    ADD CONSTRAINT doj_subject_profiles_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_subject_profiles_linked_user_id_fkey') THEN
        ALTER TABLE public.doj_subject_profiles DROP CONSTRAINT doj_subject_profiles_linked_user_id_fkey;
    END IF;
    
    ALTER TABLE public.doj_subject_profiles 
    ADD CONSTRAINT doj_subject_profiles_linked_user_id_fkey 
    FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 7. doj_sanctions (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_sanctions_created_by_fkey') THEN
        ALTER TABLE public.doj_sanctions DROP CONSTRAINT doj_sanctions_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_sanctions 
    ADD CONSTRAINT doj_sanctions_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 8. ia_subject_profiles (created_by & linked_user_id) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_subject_profiles_created_by_fkey') THEN
        ALTER TABLE public.ia_subject_profiles DROP CONSTRAINT ia_subject_profiles_created_by_fkey;
    END IF;
    
    ALTER TABLE public.ia_subject_profiles 
    ADD CONSTRAINT ia_subject_profiles_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_subject_profiles_linked_user_id_fkey') THEN
        ALTER TABLE public.ia_subject_profiles DROP CONSTRAINT ia_subject_profiles_linked_user_id_fkey;
    END IF;
    
    ALTER TABLE public.ia_subject_profiles 
    ADD CONSTRAINT ia_subject_profiles_linked_user_id_fkey 
    FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 9. ia_sanctions (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_sanctions_created_by_fkey') THEN
        ALTER TABLE public.ia_sanctions DROP CONSTRAINT ia_sanctions_created_by_fkey;
    END IF;
    
    ALTER TABLE public.ia_sanctions 
    ADD CONSTRAINT ia_sanctions_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 10. doj_documentation (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_documentation_created_by_fkey') THEN
        ALTER TABLE public.doj_documentation DROP CONSTRAINT doj_documentation_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_documentation 
    ADD CONSTRAINT doj_documentation_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 11. ia_documentation (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_documentation_created_by_fkey') THEN
        ALTER TABLE public.ia_documentation DROP CONSTRAINT ia_documentation_created_by_fkey;
    END IF;
    
    ALTER TABLE public.ia_documentation 
    ADD CONSTRAINT ia_documentation_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 12. doj_cases (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_cases_created_by_fkey') THEN
        ALTER TABLE public.doj_cases DROP CONSTRAINT doj_cases_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_cases 
    ADD CONSTRAINT doj_cases_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 13. doj_case_updates (author_id) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_case_updates_author_id_fkey') THEN
        ALTER TABLE public.doj_case_updates DROP CONSTRAINT doj_case_updates_author_id_fkey;
    END IF;
    
    ALTER TABLE public.doj_case_updates 
    ADD CONSTRAINT doj_case_updates_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 14. doj_interrogations (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'doj_interrogations_created_by_fkey') THEN
        ALTER TABLE public.doj_interrogations DROP CONSTRAINT doj_interrogations_created_by_fkey;
    END IF;
    
    ALTER TABLE public.doj_interrogations 
    ADD CONSTRAINT doj_interrogations_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 15. ia_cases (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_cases_created_by_fkey') THEN
        ALTER TABLE public.ia_cases DROP CONSTRAINT ia_cases_created_by_fkey;
    END IF;
    
    ALTER TABLE public.ia_cases 
    ADD CONSTRAINT ia_cases_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 16. ia_case_updates (author_id) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_case_updates_author_id_fkey') THEN
        ALTER TABLE public.ia_case_updates DROP CONSTRAINT ia_case_updates_author_id_fkey;
    END IF;
    
    ALTER TABLE public.ia_case_updates 
    ADD CONSTRAINT ia_case_updates_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 17. ia_interrogations (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ia_interrogations_created_by_fkey') THEN
        ALTER TABLE public.ia_interrogations DROP CONSTRAINT ia_interrogations_created_by_fkey;
    END IF;
    
    ALTER TABLE public.ia_interrogations 
    ADD CONSTRAINT ia_interrogations_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;

-- 18. judicial_orders (created_by) -> SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'judicial_orders_created_by_fkey') THEN
        ALTER TABLE public.judicial_orders DROP CONSTRAINT judicial_orders_created_by_fkey;
    END IF;
    
    ALTER TABLE public.judicial_orders 
    ADD CONSTRAINT judicial_orders_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;
