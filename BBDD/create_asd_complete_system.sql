-- =========================================================================
-- SISTEMA INTEGRAL PARA AIR SUPPORT DIVISION (ASD)
-- Cuadrilla, Jerarquías de Rango, Habilitaciones e Infracciones de División
-- =========================================================================

-- 1. Tabla de Rangos de ASD
CREATE TABLE IF NOT EXISTS public.asd_ranks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  color TEXT DEFAULT '#3b82f6',
  abbrev TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Licencias / Habilitaciones de ASD
CREATE TABLE IF NOT EXISTS public.asd_licenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT '🪪',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Integrantes de Cuadrilla ASD
CREATE TABLE IF NOT EXISTS public.asd_members (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  callsign TEXT NOT NULL,
  no_placa TEXT,
  rank_id TEXT REFERENCES public.asd_ranks(id) ON DELETE SET NULL,
  licenses JSONB DEFAULT '[]'::jsonb,
  avatar TEXT,
  status TEXT DEFAULT 'En Servicio',
  phone TEXT,
  joined_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Infracciones de ASD (Leves, Medias, Graves)
CREATE TABLE IF NOT EXISTS public.asd_infractions (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES public.asd_members(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  member_callsign TEXT,
  level TEXT NOT NULL CHECK (level IN ('Leve', 'Media', 'Grave')),
  reason TEXT NOT NULL,
  sanction TEXT,
  issued_by TEXT,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Activa' CHECK (status IN ('Activa', 'Cumplida', 'Anulada')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.asd_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asd_infractions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para autenticados
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_ranks' AND policyname = 'asd_ranks_all') THEN
        CREATE POLICY "asd_ranks_all" ON public.asd_ranks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_licenses' AND policyname = 'asd_licenses_all') THEN
        CREATE POLICY "asd_licenses_all" ON public.asd_licenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_members' AND policyname = 'asd_members_all') THEN
        CREATE POLICY "asd_members_all" ON public.asd_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asd_infractions' AND policyname = 'asd_infractions_all') THEN
        CREATE POLICY "asd_infractions_all" ON public.asd_infractions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Datos iniciales de Rangos por defecto
INSERT INTO public.asd_ranks (id, name, level, color, abbrev) VALUES
  ('rank-1', 'Comandante de ASD', 1, '#eab308', 'COM-ASD'),
  ('rank-2', 'Capitán de Escuadrón', 2, '#f97316', 'CAP-ASD'),
  ('rank-3', 'Piloto Táctico Instructor', 3, '#06b6d4', 'PTI'),
  ('rank-4', 'Piloto de Operaciones Especiales', 4, '#3b82f6', 'POE'),
  ('rank-5', 'Oficial de Vuelo Táctico (TFO)', 5, '#10b981', 'TFO'),
  ('rank-6', 'Piloto en Prácticas', 6, '#94a3b8', 'PRAC')
ON CONFLICT (id) DO NOTHING;

-- Datos iniciales de Licencias por defecto (Rápel, Artillero, Operaciones Anfibias)
INSERT INTO public.asd_licenses (id, name, code, color, icon, description) VALUES
  ('lic-1', 'Rápel', 'ASD-RPL', '#3b82f6', '🪢', 'Habilitación para inserción y descenso rápido Fast-Rope desde helicóptero'),
  ('lic-2', 'Artillero', 'ASD-ART', '#ef4444', '🎯', 'Tirador aéreo de precisión y fuego de cobertura desde aeronave'),
  ('lic-3', 'Operaciones Anfibias', 'ASD-ANF', '#06b6d4', '🌊', 'Rescate marítimo, amerizaje de emergencia y operaciones en costas')
ON CONFLICT (id) DO NOTHING;

-- Integrantes iniciales de Cuadrilla
INSERT INTO public.asd_members (id, nombre, apellido, callsign, no_placa, rank_id, licenses, status) VALUES
  ('asd-user-1', 'Marcus', 'Miller', 'AIR-01', '101', 'rank-1', '["Rápel", "Artillero", "Operaciones Anfibias"]'::jsonb, 'En Servicio'),
  ('asd-user-2', 'Alex', 'Ross', 'AIR-02', '108', 'rank-2', '["Rápel", "Artillero"]'::jsonb, 'En Servicio'),
  ('asd-user-3', 'Sarah', 'Vance', 'HAWK-1', '115', 'rank-3', '["Rápel", "Operaciones Anfibias"]'::jsonb, 'En Servicio'),
  ('asd-user-4', 'David', 'Connor', 'EAGLE-3', '124', 'rank-4', '["Rápel", "Artillero"]'::jsonb, 'En Servicio'),
  ('asd-user-5', 'James', 'Carter', 'AIR-03', '132', 'rank-5', '["Rápel"]'::jsonb, 'En Servicio'),
  ('asd-user-6', 'Lucas', 'Miller', 'SPARROW-1', '140', 'rank-6', '[]'::jsonb, 'En Prácticas')
ON CONFLICT (id) DO NOTHING;
