-- SQL Migration: Add rango_interno column to users, create coordination_internal_ranks table and enable RLS

ALTER TABLE users ADD COLUMN IF NOT EXISTS rango_interno TEXT DEFAULT 'Auxiliar de Investigación';

CREATE TABLE IF NOT EXISTS public.coordination_internal_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default internal rank
INSERT INTO public.coordination_internal_ranks (name) 
VALUES ('Auxiliar de Investigación') 
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (RLS) to resolve Supabase security warning
ALTER TABLE public.coordination_internal_ranks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read internal ranks" ON public.coordination_internal_ranks;
DROP POLICY IF EXISTS "Allow authenticated manage internal ranks" ON public.coordination_internal_ranks;

-- Create RLS Policies
CREATE POLICY "Allow authenticated read internal ranks"
ON public.coordination_internal_ranks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated manage internal ranks"
ON public.coordination_internal_ranks
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
