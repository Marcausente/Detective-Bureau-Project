-- =========================================================================
-- REGISTRO DE VUELOS Y MODELOS DE AERONAVES PARA AIR SUPPORT DIVISION (ASD)
-- =========================================================================

-- 1. Tabla de Modelos de Aeronaves
CREATE TABLE IF NOT EXISTS public.asd_aircraft_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Helicóptero',
  registration TEXT,
  description TEXT,
  status TEXT DEFAULT 'Operativo' CHECK (status IN ('Operativo', 'Mantenimiento', 'Baja')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Registros de Vuelo
CREATE TABLE IF NOT EXISTS public.asd_flight_logs (
  id TEXT PRIMARY KEY,
  pilot_id TEXT REFERENCES public.asd_members(id) ON DELETE SET NULL,
  pilot_name TEXT NOT NULL,
  pilot_callsign TEXT NOT NULL,
  aircraft_model TEXT NOT NULL,
  reason TEXT NOT NULL,
  reason_other TEXT,
  date DATE DEFAULT CURRENT_DATE,
  departure_time TEXT NOT NULL,
  landing_time TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Aprobado', 'Rechazado')),
  reviewed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.asd_aircraft_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_flight_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitir lectura pública de modelos y miembros para el formulario público
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_aircraft_models' AND policyname = 'asd_models_public_read') THEN
        CREATE POLICY "asd_models_public_read" ON public.asd_aircraft_models FOR SELECT TO anon, authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_aircraft_models' AND policyname = 'asd_models_auth_all') THEN
        CREATE POLICY "asd_models_auth_all" ON public.asd_aircraft_models FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_members' AND policyname = 'asd_members_public_read') THEN
        CREATE POLICY "asd_members_public_read" ON public.asd_members FOR SELECT TO anon, authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_flight_logs' AND policyname = 'asd_flight_logs_public_insert') THEN
        CREATE POLICY "asd_flight_logs_public_insert" ON public.asd_flight_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_flight_logs' AND policyname = 'asd_flight_logs_auth_all') THEN
        CREATE POLICY "asd_flight_logs_auth_all" ON public.asd_flight_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Datos iniciales de modelos de aeronave por defecto
INSERT INTO public.asd_aircraft_models (id, name, type, registration, status) VALUES
  ('model-1', 'Maverick', 'Helicóptero Ligero / Patrullaje', 'POLMAV-01', 'Operativo'),
  ('model-2', 'SuperVolito Carbon', 'Helicóptero Táctico / VIP', 'AIR-TAC-02', 'Operativo'),
  ('model-3', 'Frogger', 'Helicóptero de Apoyo y Rescate', 'RESCUE-03', 'Operativo')
ON CONFLICT (id) DO NOTHING;
