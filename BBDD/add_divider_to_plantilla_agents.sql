-- ==============================================================================
-- MIGRACIÓN: Soporte de Barras Divisorias / Secciones en Plantilla de Agentes
-- Permite agrupar agentes en apartados (Jefatura, Command, Sargentos, Detectives, etc.)
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_agents' 
        AND column_name = 'is_divider'
    ) THEN
        ALTER TABLE public.plantilla_agents 
        ADD COLUMN is_divider BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_agents' 
        AND column_name = 'divider_title'
    ) THEN
        ALTER TABLE public.plantilla_agents 
        ADD COLUMN divider_title TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_agents' 
        AND column_name = 'divider_color'
    ) THEN
        ALTER TABLE public.plantilla_agents 
        ADD COLUMN divider_color TEXT DEFAULT '#3b82f6';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_agents' 
        AND column_name = 'divider_icon'
    ) THEN
        ALTER TABLE public.plantilla_agents 
        ADD COLUMN divider_icon TEXT DEFAULT '📁';
    END IF;
END $$;

