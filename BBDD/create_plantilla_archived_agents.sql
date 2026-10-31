-- ==============================================================================
-- MIGRACIÓN: Tabla y configuración de Antiguos Miembros (Archivo de Bajas)
-- ==============================================================================
-- Guarda el historial de miembros que han abandonado la facción:
-- - Usuario, Correo, Nombre y Apellido, Placa, Rango
-- - Motivo/Nota de salida (editable)
-- - Estado de vetado de la facción (is_banned)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.plantilla_archived_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID,
    username TEXT,
    email TEXT,
    nombre TEXT,
    apellido TEXT,
    no_placa TEXT,
    rank_name TEXT,
    avatar_url TEXT,
    reason TEXT DEFAULT '',
    is_banned BOOLEAN DEFAULT FALSE,
    archived_by TEXT DEFAULT '',
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_archived_agents_placa ON public.plantilla_archived_agents(no_placa);
CREATE INDEX IF NOT EXISTS idx_archived_agents_is_banned ON public.plantilla_archived_agents(is_banned);
CREATE INDEX IF NOT EXISTS idx_archived_agents_archived_at ON public.plantilla_archived_agents(archived_at DESC);

-- Habilitar RLS
ALTER TABLE public.plantilla_archived_agents ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para authenticated (y lectura pública si aplica)
DO $$
BEGIN
    DROP POLICY IF EXISTS "plantilla_archived_agents_read" ON public.plantilla_archived_agents;
    CREATE POLICY "plantilla_archived_agents_read" ON public.plantilla_archived_agents
        FOR SELECT TO public USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "plantilla_archived_agents_write" ON public.plantilla_archived_agents;
    CREATE POLICY "plantilla_archived_agents_write" ON public.plantilla_archived_agents
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Configurar REPLICA IDENTITY FULL para sincronización en Realtime
ALTER TABLE public.plantilla_archived_agents REPLICA IDENTITY FULL;

-- Agregar a la publicación supabase_realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'plantilla_archived_agents'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.plantilla_archived_agents;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

