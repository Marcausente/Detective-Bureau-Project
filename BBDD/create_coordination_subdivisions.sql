-- create_coordination_subdivisions.sql
-- Migration to create coordination_subdivisions table and default data

CREATE TABLE IF NOT EXISTS public.coordination_subdivisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    abbrev TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default initial subdivisions
INSERT INTO public.coordination_subdivisions (name, abbrev, is_default)
VALUES 
    ('Gang Unit', 'GU', true),
    ('Undercover Division', 'UD', true),
    ('General Crimes', 'GC', true),
    ('Detective Training Program', 'DTP', true)
ON CONFLICT (name) DO UPDATE 
SET abbrev = EXCLUDED.abbrev, is_default = EXCLUDED.is_default;

-- Enable RLS
ALTER TABLE public.coordination_subdivisions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read subdivisions" ON public.coordination_subdivisions;
DROP POLICY IF EXISTS "Allow authenticated manage subdivisions" ON public.coordination_subdivisions;

-- Create RLS Policies
CREATE POLICY "Allow authenticated read subdivisions"
ON public.coordination_subdivisions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated manage subdivisions"
ON public.coordination_subdivisions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
