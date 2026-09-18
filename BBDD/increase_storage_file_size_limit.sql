-- ====================================================================
-- AUMENTAR LÍMITE DE TAMAÑO DE ARCHIVOS EN SUPABASE STORAGE (BUCKET 'uploads')
-- ====================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- Por defecto algunos buckets se crean con límite de 2MB o 5MB.
-- Este script amplía el límite del bucket 'uploads' a 50MB (52,428,800 bytes),
-- permitiendo subir documentos y PDFs pesados en las vigilancias.

-- 1. Actualizar el límite del bucket 'uploads' a 50MB y remover restricciones restrictivas de MIME types
UPDATE storage.buckets
SET file_size_limit = 52428800, -- 50 MB (50 * 1024 * 1024 bytes)
    allowed_mime_types = NULL
WHERE id = 'uploads';

-- 2. Asegurar inserción si no existía previamente
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', true, 52428800)
ON CONFLICT (id) DO UPDATE 
SET public = true, 
    file_size_limit = 52428800;
