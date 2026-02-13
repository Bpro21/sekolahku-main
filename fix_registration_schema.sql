-- ================================================================
-- MASTER FIX SCHEMA LENGKAP (REGISTRATIONS, PAYMENT, SETTINGS)
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. TABEL REGISTRATIONS (PENDAFTARAN)
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
ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_scholarship boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS uploaded_docs jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS biodata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.registrations ALTER COLUMN status SET DEFAULT 'submitted';

-- 2. TABEL PAYMENT CONFIG (KONFIGURASI PEMBAYARAN)
CREATE TABLE IF NOT EXISTS public.payment_config (
    id text PRIMARY KEY DEFAULT 'main',
    gateway_active text DEFAULT 'manual',
    manual_banks jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Insert data default jika belum ada
INSERT INTO public.payment_config (id, gateway_active, manual_banks)
SELECT 'main', 'manual', '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.payment_config WHERE id = 'main');

-- 3. TABEL APP SETTINGS (PENGATURAN APLIKASI)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id text PRIMARY KEY DEFAULT 'main',
    app_name text DEFAULT 'PSB Online',
    app_logo text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Insert data default jika belum ada
INSERT INTO public.app_settings (id, app_name)
SELECT 'main', 'PSB Online'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 'main');

-- 4. DISABLE RLS (Sangat Penting untuk menghindari 406/401 di dev)
ALTER TABLE public.registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;

-- 5. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- 6. VERIFIKASI
SELECT 'Tabel registrations OK' as status WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'student_name');
SELECT 'Tabel payment_config OK' as status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_config');
SELECT 'Tabel app_settings OK' as status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings');
