-- ==============================================================================
-- MIGRACIÓN: Habilitar Supabase Realtime para Plantilla de Agentes y Comandancia
-- ==============================================================================
-- Permite que los cambios en plantilla_agents, app_settings, ia_sanctions, etc.
-- se transmitan instantáneamente vía WebSockets a todos los navegadores conectados
-- sin necesidad de recargar la página.
-- ==============================================================================

DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'app_settings',
        'plantilla_agents',
        'plantilla_archived_agents',
        'plantilla_ranks',
        'plantilla_divisions',
        'ia_sanctions',
        'ia_subject_profiles',
        'agent_feedbacks',
        'agent_feedback_reactions'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        -- Verificar si la tabla existe en el esquema public
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- 1. Configurar REPLICA IDENTITY FULL para asegurar que se transmitan todos los datos en updates y deletes
            EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
            RAISE NOTICE 'REPLICA IDENTITY FULL habilitado en public.%', tbl;
            
            -- 2. Añadir la tabla a la publicación supabase_realtime si no está ya presente
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                  AND schemaname = 'public' 
                  AND tablename = tbl
            ) THEN
                BEGIN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
                    RAISE NOTICE 'Tabla public.% agregada a supabase_realtime', tbl;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'No se pudo agregar public.% a supabase_realtime: %', tbl, SQLERRM;
                END;
            ELSE
                RAISE NOTICE 'Tabla public.% ya pertenecía a supabase_realtime', tbl;
            END IF;
        END IF;
    END LOOP;
END $$;

