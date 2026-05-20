-- Migration to update app_rank enum and helper functions with the new ranks

-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in some Postgres versions.
-- Run these statements in your Supabase SQL editor:

ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Deputy Sheriff' BEFORE 'Oficial II';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Oficial I' AFTER 'Deputy Sheriff';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Deputy Sheriff Bonus I' AFTER 'Oficial I';

ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Deputy Sheriff Bonus II' BEFORE 'Oficial III';

ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Internal Affairs Agent' BEFORE 'Teniente';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Department of Justice Agent' BEFORE 'Teniente';

ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Comandante' AFTER 'Capitan';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Division Chief' AFTER 'Comandante';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Assistant Sheriff' AFTER 'Division Chief';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Undersheriff' AFTER 'Assistant Sheriff';
ALTER TYPE public.app_rank ADD VALUE IF NOT EXISTS 'Sheriff' AFTER 'Undersheriff';

-- Redefine public.get_rank_level with the new ranks
CREATE OR REPLACE FUNCTION public.get_rank_level(r public.app_rank) RETURNS INTEGER AS $$
BEGIN
    RETURN CASE r
        WHEN 'Deputy Sheriff' THEN 10
        WHEN 'Oficial I' THEN 15
        WHEN 'Deputy Sheriff Bonus I' THEN 20
        WHEN 'Oficial II' THEN 30
        WHEN 'Deputy Sheriff Bonus II' THEN 35
        WHEN 'Oficial III' THEN 40
        WHEN 'Oficial III+' THEN 50
        WHEN 'Detective I' THEN 60
        WHEN 'Detective II' THEN 70
        WHEN 'Detective III' THEN 80
        WHEN 'Internal Affairs Agent' THEN 85
        WHEN 'Department of Justice Agent' THEN 85
        WHEN 'Teniente' THEN 90
        WHEN 'Capitan' THEN 100
        WHEN 'Comandante' THEN 110
        WHEN 'Division Chief' THEN 120
        WHEN 'Assistant Sheriff' THEN 130
        WHEN 'Undersheriff' THEN 140
        WHEN 'Sheriff' THEN 150
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
