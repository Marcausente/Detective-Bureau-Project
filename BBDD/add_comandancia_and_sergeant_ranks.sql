-- ==============================================================================
-- ACTUALIZACIÓN: RANGOS DE SARGENTO Y DIVISIÓN/APARTADO DE COMANDANCIA
-- 1. Añade 'Sargento I' (tras 'Detective I') y 'Sargento II' (tras 'Detective II')
-- 2. Crea tabla y políticas para Directivas de Comandancia
-- ==============================================================================

-- 1. Agregar nuevos rangos al tipo ENUM app_rank
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_rank') THEN
        -- Añadir 'Sargento I' justo después de 'Detective I'
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Sargento I' AND enumtypid = 'app_rank'::regtype) THEN
            ALTER TYPE app_rank ADD VALUE 'Sargento I' AFTER 'Detective I';
        END IF;

        -- Añadir 'Sargento II' justo después de 'Detective II'
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Sargento II' AND enumtypid = 'app_rank'::regtype) THEN
            ALTER TYPE app_rank ADD VALUE 'Sargento II' AFTER 'Detective II';
        END IF;
    END IF;
END $$;

-- 2. Crear tabla para Directivas y Decretos de Comandancia
CREATE TABLE IF NOT EXISTS public.comandancia_directives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Directiva General',
    priority TEXT NOT NULL DEFAULT 'Media',
    content TEXT NOT NULL,
    target_divisions TEXT[] DEFAULT '{"Todas"}',
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    author_name TEXT,
    author_rank TEXT,
    status TEXT NOT NULL DEFAULT 'Vigente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE public.comandancia_directives ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS)
DROP POLICY IF EXISTS "Allow read comandancia_directives" ON public.comandancia_directives;
CREATE POLICY "Allow read comandancia_directives"
  ON public.comandancia_directives FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow manage comandancia_directives" ON public.comandancia_directives;
CREATE POLICY "Allow manage comandancia_directives"
  ON public.comandancia_directives FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND (
        public.users.rol::text IN ('Comisionado', 'Administrador')
        OR (public.users.divisions IS NOT NULL AND 'Comandancia' = ANY(public.users.divisions))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND (
        public.users.rol::text IN ('Comisionado', 'Administrador')
        OR (public.users.divisions IS NOT NULL AND 'Comandancia' = ANY(public.users.divisions))
      )
    )
  );

GRANT ALL ON public.comandancia_directives TO authenticated;
GRANT ALL ON public.comandancia_directives TO service_role;
