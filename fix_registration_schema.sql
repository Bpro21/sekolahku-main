-- ================================================================
-- MASTER FIX SCHEMA V2 (ID TYPE SYNC & DETERMINISTIC SUPPORT)
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. UBAH TIPE ID MENJADI TEXT (Agar mendukung ID Deterministik/Custom)
-- Kita harus drop foreign key dulu, ubah tipe, baru pasang lagi.

-- A. Drop Foreign Keys yang merujuk ke registrations.id
ALTER TABLE IF EXISTS public.invoices DROP CONSTRAINT IF EXISTS invoices_registration_id_fkey;
ALTER TABLE IF EXISTS public.indent_submissions DROP CONSTRAINT IF EXISTS indent_submissions_registration_id_fkey;

-- B. Ubah tipe id di tabel registrations
ALTER TABLE public.registrations ALTER COLUMN id TYPE text;

-- C. Ubah tipe id & registration_id di tabel invoices
ALTER TABLE public.invoices ALTER COLUMN id TYPE text;
ALTER TABLE public.invoices ALTER COLUMN registration_id TYPE text;

-- D. Pasang kembali Foreign Keys (Opsional tapi baik untuk integritas)
ALTER TABLE public.invoices ADD CONSTRAINT invoices_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE CASCADE;

-- 2. LENGKAPI KOLOM TABEL REGISTRATIONS
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS student_name text,
ADD COLUMN IF NOT EXISTS parent_name text,
ADD COLUMN IF NOT EXISTS student_religion text,
ADD COLUMN IF NOT EXISTS cost_reg integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_rereg integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_id text,
ADD COLUMN IF NOT EXISTS unit_name text,
ADD COLUMN IF NOT EXISTS path_name text,
ADD COLUMN IF NOT EXISTS wave_name text,
ADD COLUMN IF NOT EXISTS academic_year text,
ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS uploaded_docs jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS biodata jsonb DEFAULT '{}'::jsonb;

-- 3. LENGKAPI TABEL INVOICES
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS student_name text,
ADD COLUMN IF NOT EXISTS amount bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS proof_of_transfer text,
ADD COLUMN IF NOT EXISTS installment_schedule jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS paid_at timestamptz,
ADD COLUMN IF NOT EXISTS bank_destination text,
ADD COLUMN IF NOT EXISTS user_id uuid;

-- 4. TABEL PENDUKUNG (PAYMENT & APP)
CREATE TABLE IF NOT EXISTS public.payment_config (
    id text PRIMARY KEY DEFAULT 'main',
    gateway_active text DEFAULT 'manual',
    manual_banks jsonb DEFAULT '[]'::jsonb
);

INSERT INTO public.payment_config (id, gateway_active)
SELECT 'main', 'manual' WHERE NOT EXISTS (SELECT 1 FROM public.payment_config WHERE id = 'main');

CREATE TABLE IF NOT EXISTS public.app_settings (
    id text PRIMARY KEY DEFAULT 'main',
    app_name text DEFAULT 'PSB Online'
);

INSERT INTO public.app_settings (id, app_name)
SELECT 'main', 'PSB Online' WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 'main');

-- 5. MATIKAN RLS (Untuk kemudahan Sync)
ALTER TABLE public.registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;

-- 6. REFRESH CACHE
NOTIFY pgrst, 'reload schema';

-- 7. VERIFIKASI
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('registrations', 'invoices') AND column_name = 'id';
