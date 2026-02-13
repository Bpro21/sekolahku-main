-- ================================================================
-- MASTER FIX SCHEMA PENDAFTARAN (REGISTRATIONS)
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. Tambahkan SEMUA kolom yang dibutuhkan aplikasi (Lengkap & Aman)
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
ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS uploaded_docs jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS biodata jsonb DEFAULT '{}'::jsonb;

-- 2. Pastikan kolom 'updated_at' ada (sering menyebabkan error jika kurang)
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Set default status agar valid
ALTER TABLE public.registrations 
ALTER COLUMN status SET DEFAULT 'submitted';

-- 4. REFRESH CACHE (SANGAT KRUSIAL)
-- Gunakan NOTIFY dan paksa reload schema
NOTIFY pgrst, 'reload schema';

-- 5. VERIFIKASI (Hasil harus menunjukkan semua kolom di atas)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'registrations' 
AND column_name IN (
    'student_name', 'parent_name', 'unit_name', 'path_name', 'academic_year', 'biodata', 'documents', 'uploaded_docs'
)
ORDER BY column_name;
