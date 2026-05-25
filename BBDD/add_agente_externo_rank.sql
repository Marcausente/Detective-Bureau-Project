-- Añadir el rango 'Agente Externo' al ENUM de rangos de la base de datos

ALTER TYPE app_rank ADD VALUE IF NOT EXISTS 'Agente Externo';
