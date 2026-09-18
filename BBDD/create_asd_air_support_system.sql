-- Sistema para Air Support Division (ASD): Misiones, Bitácora de Vuelos y Flota de Aeronaves

-- 1. Tabla de Misiones Aéreas
CREATE TABLE IF NOT EXISTS public.asd_missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  callsign TEXT NOT NULL DEFAULT 'AIR-1',
  pilot TEXT,
  tfo TEXT,
  status TEXT NOT NULL DEFAULT 'En Vuelo',
  zone TEXT DEFAULT 'Los Santos Metro',
  altitude TEXT DEFAULT '1500 FT',
  equipment TEXT DEFAULT 'FLIR HD + Searchlight',
  objective TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Bitácora de Vuelos
CREATE TABLE IF NOT EXISTS public.asd_flight_logs (
  id TEXT PRIMARY KEY,
  callsign TEXT NOT NULL,
  pilot TEXT NOT NULL,
  tfo TEXT,
  aircraft TEXT DEFAULT 'Polmav AS350',
  "departureTime" TEXT,
  "arrivalTime" TEXT,
  "flightType" TEXT DEFAULT 'Patrullaje Preventivo',
  "incidentNumber" TEXT,
  summary TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Flota de Aeronaves
CREATE TABLE IF NOT EXISTS public.asd_fleet (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  "tailNumber" TEXT NOT NULL,
  callsign TEXT NOT NULL,
  status TEXT DEFAULT 'Operativo',
  "fuelLevel" INTEGER DEFAULT 100,
  equipment JSONB DEFAULT '["FLIR Camera HD", "NiteSun Searchlight", "Rescue Hoist"]'::jsonb,
  "lastMaintenance" DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.asd_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_flight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_fleet ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso RLS
DO $$
BEGIN
    -- Misiones
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_missions' AND policyname = 'asd_missions_select_all') THEN
        CREATE POLICY "asd_missions_select_all" ON public.asd_missions FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_missions' AND policyname = 'asd_missions_insert_all') THEN
        CREATE POLICY "asd_missions_insert_all" ON public.asd_missions FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_missions' AND policyname = 'asd_missions_update_all') THEN
        CREATE POLICY "asd_missions_update_all" ON public.asd_missions FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_missions' AND policyname = 'asd_missions_delete_all') THEN
        CREATE POLICY "asd_missions_delete_all" ON public.asd_missions FOR DELETE TO authenticated USING (true);
    END IF;

    -- Bitácora de Vuelos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_flight_logs' AND policyname = 'asd_flight_logs_select_all') THEN
        CREATE POLICY "asd_flight_logs_select_all" ON public.asd_flight_logs FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_flight_logs' AND policyname = 'asd_flight_logs_insert_all') THEN
        CREATE POLICY "asd_flight_logs_insert_all" ON public.asd_flight_logs FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_flight_logs' AND policyname = 'asd_flight_logs_delete_all') THEN
        CREATE POLICY "asd_flight_logs_delete_all" ON public.asd_flight_logs FOR DELETE TO authenticated USING (true);
    END IF;

    -- Flota de Aeronaves
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_fleet' AND policyname = 'asd_fleet_select_all') THEN
        CREATE POLICY "asd_fleet_select_all" ON public.asd_fleet FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_fleet' AND policyname = 'asd_fleet_insert_all') THEN
        CREATE POLICY "asd_fleet_insert_all" ON public.asd_fleet FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_fleet' AND policyname = 'asd_fleet_update_all') THEN
        CREATE POLICY "asd_fleet_update_all" ON public.asd_fleet FOR UPDATE TO authenticated USING (true);
    END IF;
END $$;

-- Datos iniciales de la flota por defecto
INSERT INTO public.asd_fleet (id, model, "tailNumber", callsign, status, "fuelLevel", equipment, "lastMaintenance")
VALUES 
  ('ac-1', 'Police Maverick (Eurocopter AS350)', 'N-911LS', 'AIR-1', 'Operativo', 90, '["FLIR Camera HD", "NiteSun 30M CP Searchlight", "Police Dual Radio", "Loudspeaker Array"]'::jsonb, CURRENT_DATE),
  ('ac-2', 'Police Maverick (Eurocopter AS350)', 'N-912LS', 'AIR-2', 'Operativo', 75, '["FLIR Camera HD", "NiteSun Searchlight", "Rescue Hoist"]'::jsonb, CURRENT_DATE),
  ('ac-3', 'Bell 412 Tactical Transport', 'N-920TAC', 'AIR-TAC', 'Standby', 100, '["Fast Rope Winch System", "Thermal Array", "Heavy Cargo Hoist"]'::jsonb, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
