-- ==============================================================================
-- ACTUALIZACIÓN: AGREGAR RANGOS 'Oficial III+' Y 'FTO'
-- 1. Añade 'Oficial III+' (si no existe) y 'FTO' al enum app_rank
-- 2. Ambos rangos se posicionan por encima de 'Oficial III' y 'Deputy Sheriff Bonus II'
--    y por debajo de 'Detective I'
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_rank') THEN
        -- Añadir 'Oficial III+' después de 'Oficial III' si aún no existe
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Oficial III+' AND enumtypid = 'app_rank'::regtype) THEN
            ALTER TYPE app_rank ADD VALUE 'Oficial III+' AFTER 'Oficial III';
        END IF;

        -- Añadir 'FTO' después de 'Oficial III+'
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FTO' AND enumtypid = 'app_rank'::regtype) THEN
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Oficial III+' AND enumtypid = 'app_rank'::regtype) THEN
                ALTER TYPE app_rank ADD VALUE 'FTO' AFTER 'Oficial III+';
            ELSE
                ALTER TYPE app_rank ADD VALUE 'FTO' AFTER 'Oficial III';
            END IF;
        END IF;
    END IF;
END $$;
