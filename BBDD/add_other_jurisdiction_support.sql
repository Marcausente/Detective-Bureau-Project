-- MIGRATION: Support for 'De Otra Jurisdiccion' & Transferred Incidents
-- Adds transferred_to_other_jurisdiction column to incidents table if not exists

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'incidents' 
          AND column_name = 'transferred_to_other_jurisdiction'
    ) THEN
        ALTER TABLE public.incidents ADD COLUMN transferred_to_other_jurisdiction BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Optional: ensure app_settings table exists for settings persistence
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and permissions for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert or update app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can insert or update app_settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

