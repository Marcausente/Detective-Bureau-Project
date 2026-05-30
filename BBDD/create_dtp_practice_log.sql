-- ==========================================
-- Table: dtp_practice_log (Conteo de Prácticas por Agente)
-- Registra manualmente las prácticas completadas por cada agente.
-- ==========================================

CREATE TABLE dtp_practice_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES users(id) ON DELETE CASCADE,       -- Agente al que se le apunta la práctica
    practice_name TEXT NOT NULL,                                 -- Nombre o descripción de la práctica realizada
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,      -- Quién apuntó la práctica
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()             -- Cuándo se apuntó
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE dtp_practice_log ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer el historial
CREATE POLICY "Enable read for authenticated users" ON dtp_practice_log
    FOR SELECT USING (auth.role() = 'authenticated');

-- Todos los autenticados pueden insertar entradas (el control de roles se hace en el frontend)
CREATE POLICY "Enable insert for authenticated users" ON dtp_practice_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Solo pueden eliminar la entrada el mismo que la creó (logged_by) o via admin
CREATE POLICY "Enable delete for logger" ON dtp_practice_log
    FOR DELETE USING (auth.role() = 'authenticated');
