-- ==============================================================================
-- MIGRATION: Gangs Wipe Folders System
-- Permite almacenar y organizar bandas / grupos delictivos en carpetas de wipe (ej: Actual, Wipe 2025, Wipe 2026).
-- Solo los administradores pueden gestionar, ver y alternar carpetas de wipe archivadas.
-- Los usuarios regulares ven únicamente la carpeta de wipe establecida como activa ('Actual' por defecto).
-- ==============================================================================

-- 1. Añadir columna wipe_folder a la tabla gangs si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'gangs' 
          AND column_name = 'wipe_folder'
    ) THEN
        ALTER TABLE public.gangs ADD COLUMN wipe_folder TEXT DEFAULT 'Actual';
    END IF;
END $$;

-- 2. Asegurar que las bandas existentes tengan 'Actual' como carpeta por defecto
UPDATE public.gangs 
SET wipe_folder = 'Actual' 
WHERE wipe_folder IS NULL OR TRIM(wipe_folder) = '';

-- 3. Crear índice para optimizar filtrados por carpeta de wipe en gangs
CREATE INDEX IF NOT EXISTS idx_gangs_wipe_folder ON public.gangs (wipe_folder);

-- 4. Asegurar que app_settings cuenta con los registros iniciales para Wipes de Bandas
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('gangs_active_wipe_folder', 'Actual', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('gangs_wipe_folders', '["Actual"]', NOW())
ON CONFLICT (key) DO NOTHING;
