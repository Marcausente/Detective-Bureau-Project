-- SQL Migration: Add rango_interno column to users and create coordination_internal_ranks table

ALTER TABLE users ADD COLUMN IF NOT EXISTS rango_interno TEXT DEFAULT 'Auxiliar de Investigación';

CREATE TABLE IF NOT EXISTS coordination_internal_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default internal rank
INSERT INTO coordination_internal_ranks (name) 
VALUES ('Auxiliar de Investigación') 
ON CONFLICT (name) DO NOTHING;
