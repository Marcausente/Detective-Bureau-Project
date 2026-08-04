-- ======================================================
-- POLÍTICAS RLS PARA SUPABASE STORAGE (BUCKET 'uploads')
-- ======================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- para corregir el error: "new row violates row-level security policy"

-- 1. Asegurar que el bucket 'uploads' exista y sea público
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permitir lectura pública de archivos en el bucket 'uploads'
DROP POLICY IF EXISTS "Public Read Access on uploads bucket" ON storage.objects;
CREATE POLICY "Public Read Access on uploads bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- 3. Permitir subida de archivos (INSERT) al bucket 'uploads'
DROP POLICY IF EXISTS "Public Insert Access on uploads bucket" ON storage.objects;
CREATE POLICY "Public Insert Access on uploads bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads');

-- 4. Permitir modificación de archivos (UPDATE) en el bucket 'uploads'
DROP POLICY IF EXISTS "Public Update Access on uploads bucket" ON storage.objects;
CREATE POLICY "Public Update Access on uploads bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'uploads');

-- 5. Permitir borrado de archivos (DELETE) en el bucket 'uploads'
DROP POLICY IF EXISTS "Public Delete Access on uploads bucket" ON storage.objects;
CREATE POLICY "Public Delete Access on uploads bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads');
