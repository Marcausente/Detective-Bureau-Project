-- CREATE IA COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.ia_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    denunciante_nombre TEXT NOT NULL,
    denunciante_telefono TEXT NOT NULL,
    denunciado_nombre_placa TEXT NOT NULL,
    fecha_hechos DATE NOT NULL,
    motivo TEXT NOT NULL,
    declaracion TEXT NOT NULL,
    pruebas TEXT,
    status TEXT DEFAULT 'Incoming' CHECK (status IN ('Incoming', 'With Case', 'Closed')),
    case_id UUID REFERENCES public.ia_cases(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ia_complaints ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a complaint (Public Insert)
DROP POLICY IF EXISTS "Allow public inserts on ia_complaints" ON public.ia_complaints;
CREATE POLICY "Allow public inserts on ia_complaints" 
  ON public.ia_complaints FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow authenticated users to view/manage complaints
DROP POLICY IF EXISTS "Allow auth select on ia_complaints" ON public.ia_complaints;
CREATE POLICY "Allow auth select on ia_complaints" 
  ON public.ia_complaints FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow auth update on ia_complaints" ON public.ia_complaints;
CREATE POLICY "Allow auth update on ia_complaints" 
  ON public.ia_complaints FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow auth delete on ia_complaints" ON public.ia_complaints;
CREATE POLICY "Allow auth delete on ia_complaints" 
  ON public.ia_complaints FOR DELETE TO authenticated USING (true);
