-- System for SEB Operations and Tactical Planning Boards

CREATE TABLE IF NOT EXISTS public.seb_operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT,
  operatives TEXT,
  status TEXT DEFAULT 'En Progreso',
  board_data JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.seb_operations ENABLE ROW LEVEL SECURITY;

-- Policies for SEB Operations
CREATE POLICY "Allow read access to authenticated users" 
ON public.seb_operations FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow insert access to authenticated users" 
ON public.seb_operations FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users" 
ON public.seb_operations FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow delete access to authenticated users" 
ON public.seb_operations FOR DELETE 
TO authenticated 
USING (true);
