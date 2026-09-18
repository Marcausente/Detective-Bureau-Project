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
  pilot_id TEXT,
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

-- Si la tabla ya existía con clave foránea estricta, la eliminamos para permitir inserciones públicas sin bloqueos
ALTER TABLE public.asd_flight_logs DROP CONSTRAINT IF EXISTS asd_flight_logs_pilot_id_fkey;

-- Habilitar RLS
ALTER TABLE public.asd_aircraft_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_flight_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS limpias y sin deadlocks (DROP IF EXISTS + CREATE)

-- Modelos de Aeronave: Lectura pública + Gestión para autenticados
DROP POLICY IF EXISTS "asd_models_public_read" ON public.asd_aircraft_models;
CREATE POLICY "asd_models_public_read" ON public.asd_aircraft_models FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "asd_models_auth_all" ON public.asd_aircraft_models;
CREATE POLICY "asd_models_auth_all" ON public.asd_aircraft_models FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Integrantes ASD: Lectura pública para el selector de pilotos
DROP POLICY IF EXISTS "asd_members_public_read" ON public.asd_members;
CREATE POLICY "asd_members_public_read" ON public.asd_members FOR SELECT TO anon, authenticated USING (true);

-- Registros de Vuelo: Inserción pública (formulario) + Gestión para autenticados
DROP POLICY IF EXISTS "asd_flight_logs_public_insert" ON public.asd_flight_logs;
CREATE POLICY "asd_flight_logs_public_insert" ON public.asd_flight_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "asd_flight_logs_auth_all" ON public.asd_flight_logs;
CREATE POLICY "asd_flight_logs_auth_all" ON public.asd_flight_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Habilitar Realtime para ambas tablas
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asd_aircraft_models;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.asd_flight_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Datos iniciales de modelos de aeronave por defecto
INSERT INTO public.asd_aircraft_models (id, name, type, registration, status) VALUES
  ('model-1', 'Maverick', 'Helicóptero Ligero / Patrullaje', 'POLMAV-01', 'Operativo'),
  ('model-2', 'SuperVolito Carbon', 'Helicóptero Táctico / VIP', 'AIR-TAC-02', 'Operativo'),
  ('model-3', 'Frogger', 'Helicóptero de Apoyo y Rescate', 'RESCUE-03', 'Operativo')
ON CONFLICT (id) DO NOTHING;


