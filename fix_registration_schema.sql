-- ================================================================
-- FIX SCHEMA PENDAFTARAN (REGISTRATIONS) - VERSI LENGKAP
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. Tambahkan SEMUA kolom yang dibutuhkan aplikasi PSB Online
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS student_name text,
ADD COLUMN IF NOT EXISTS parent_name text,
ADD COLUMN IF NOT EXISTS student_religion text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS cost_reg integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_rereg integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_id text,
ADD COLUMN IF NOT EXISTS unit_name text,
ADD COLUMN IF NOT EXISTS unit_level text,
ADD COLUMN IF NOT EXISTS major text,
ADD COLUMN IF NOT EXISTS path_id text,
ADD COLUMN IF NOT EXISTS path_name text,
ADD COLUMN IF NOT EXISTS wave_id text,
ADD COLUMN IF NOT EXISTS wave_name text,
ADD COLUMN IF NOT EXISTS academic_year text,
ADD COLUMN IF NOT EXISTS is_indent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_scholarship boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS uploaded_docs jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS biodata jsonb DEFAULT '{}'::jsonb;

-- 2. Pastikan kolom id menggunakan UUID default jika belum ada
-- ALTER TABLE public.registrations ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Refresh Cache Schema PostgREST (Sangat Penting!)
NOTIFY pgrst, 'reload schema';

-- 4. Verifikasi Akhir
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'registrations' 
AND column_name IN (
    'student_name', 'parent_name', 'unit_name', 'path_name', 'academic_year', 'biodata'
);
