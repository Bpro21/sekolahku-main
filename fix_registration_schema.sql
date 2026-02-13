-- ================================================================
-- FIX SCHEMA PENDAFTARAN (REGISTRATIONS)
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. Tambahkan kolom yang sering hilang atau menyebabkan error 400
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS cost_reg integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_rereg integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_name text,
ADD COLUMN IF NOT EXISTS student_religion text,
ADD COLUMN IF NOT EXISTS unit_id text,
ADD COLUMN IF NOT EXISTS unit_level text,
ADD COLUMN IF NOT EXISTS path_id text,
ADD COLUMN IF NOT EXISTS path_name text,
ADD COLUMN IF NOT EXISTS wave_id text,
ADD COLUMN IF NOT EXISTS is_scholarship boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS biodata jsonb DEFAULT '{}'::jsonb;

-- 2. Pastikan kolom uploaded_docs ada (sebagai alias atau target utama)
-- Jika tabel menggunakan nama 'documents', kita pastikan 'uploaded_docs' juga ada
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS uploaded_docs jsonb DEFAULT '{}'::jsonb;

-- 3. Tambahkan kolom status jika belum ada dengan default yang benar
ALTER TABLE public.registrations 
ALTER COLUMN status SET DEFAULT 'submitted';

-- 4. Refresh Cache Schema PostgREST
NOTIFY pgrst, 'reload schema';

-- 5. Verifikasi kolom
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'registrations' 
AND column_name IN (
    'category', 'cost_reg', 'cost_rereg', 'parent_name', 
    'student_religion', 'unit_id', 'path_id', 'is_scholarship', 'biodata', 'uploaded_docs'
);
