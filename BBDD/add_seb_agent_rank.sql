-- Añadir el rango 'SEB Agent' al ENUM de rangos de la base de datos

ALTER TYPE app_rank ADD VALUE IF NOT EXISTS 'SEB Agent';

-- Actualizar la función de helper get_rank_level para evaluación y permisos
CREATE OR REPLACE FUNCTION public.get_rank_level(r app_rank) RETURNS INTEGER AS $$
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
        WHEN 'SEB Agent' THEN 85
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
