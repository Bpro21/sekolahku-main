-- =====================================================
-- COMPLETE SCHEMA untuk Sekolahku App
-- =====================================================
-- Jalankan script ini via:
-- 1. Supabase CLI: supabase db push
-- 2. psql: psql "postgresql://..." -f complete_schema.sql
-- 3. SQL Editor dengan Database Password
-- =====================================================

-- ==================== ACADEMIC YEARS ====================
-- Tambah kolom yang hilang (aman jika sudah ada)
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS indent_enabled boolean DEFAULT false;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS is_indent_open boolean DEFAULT false;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS indent_start_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS indent_end_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS unit_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS unit_names text;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ==================== UNITS (Cabang Sekolah) ====================
ALTER TABLE units ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS quota integer DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS filled integer DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS open boolean DEFAULT true;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_reg bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_rereg bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS facilities text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS info_text text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS majors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS fee_breakdown jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_breakdown jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS academic_configs jsonb DEFAULT '{}'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS spp_amount bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS spp_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ==================== WAVES (Gelombang) ====================
CREATE TABLE IF NOT EXISTS waves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    year text,
    start_date date,
    end_date date,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Tambah kolom jika sudah ada tapi belum lengkap
ALTER TABLE waves ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE waves ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE waves ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE waves ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- ==================== INDENT SETTINGS ====================
CREATE TABLE IF NOT EXISTS indent_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date date,
    end_date date,
    active boolean DEFAULT false,
    target_academic_years jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==================== APP SETTINGS ====================
CREATE TABLE IF NOT EXISTS app_settings (
    id text PRIMARY KEY DEFAULT 'main',
    app_name text DEFAULT 'PSB Online',
    app_logo text,
    app_template text DEFAULT 'berry',
    admins jsonb DEFAULT '[]'::jsonb,
    fonnte_token text,
    landing_page jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tambah kolom jika sudah ada
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_name text DEFAULT 'PSB Online';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_logo text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_template text DEFAULT 'berry';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS admins jsonb DEFAULT '[]'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS fonnte_token text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS landing_page jsonb DEFAULT '{}'::jsonb;

-- ==================== PAYMENT CONFIG ====================
CREATE TABLE IF NOT EXISTS payment_config (
    id text PRIMARY KEY DEFAULT 'main',
    gateway_active text DEFAULT 'manual',
    manual_banks jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==================== REGISTRATIONS ====================
CREATE TABLE IF NOT EXISTS registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    user_email text,
    user_phone text,
    student_name text,
    gender text,
    academic_year text,
    wave_name text,
    unit_name text,
    major text,
    branch_name text,
    status text DEFAULT 'pending',
    is_internal boolean DEFAULT false,
    is_indent boolean DEFAULT false,
    documents jsonb DEFAULT '{}'::jsonb,
    reregistration_docs jsonb DEFAULT '{}'::jsonb,
    reregistration_deferment jsonb DEFAULT '{}'::jsonb,
    reminder_history jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tambah kolom jika sudah ada
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_indent boolean DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reregistration_docs jsonb DEFAULT '{}'::jsonb;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reregistration_deferment jsonb DEFAULT '{}'::jsonb;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reminder_history jsonb DEFAULT '{}'::jsonb;

-- ==================== INVOICES ====================
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id uuid REFERENCES registrations(id),
    user_id uuid,
    description text,
    amount bigint DEFAULT 0,
    status text DEFAULT 'unpaid',
    is_installment boolean DEFAULT false,
    installment_schedule jsonb,
    payment_proof text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tambah kolom jika sudah ada
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_installment boolean DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS installment_schedule jsonb;

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    title text,
    message text,
    type text DEFAULT 'info',
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ==================== FIX ID COLUMN DEFAULTS ====================
-- Pastikan kolom id punya default gen_random_uuid()
ALTER TABLE academic_years ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE units ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE waves ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE indent_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE registrations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE invoices ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ==================== DISABLE RLS ====================
-- Disable RLS untuk development (supaya tidak error permission)
ALTER TABLE academic_years DISABLE ROW LEVEL SECURITY;
ALTER TABLE units DISABLE ROW LEVEL SECURITY;
ALTER TABLE waves DISABLE ROW LEVEL SECURITY;
ALTER TABLE indent_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ==================== REFRESH SCHEMA CACHE ====================
NOTIFY pgrst, 'reload schema';

-- ==================== INSERT DEFAULT DATA ====================
-- App Settings (jika kosong)
INSERT INTO app_settings (id, app_name, app_template)
SELECT 'main', 'PSB Online', 'berry'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 'main');

-- Academic Year default (jika kosong) - dengan explicit UUID
INSERT INTO academic_years (id, year, is_active, is_default)
SELECT gen_random_uuid(), '2025/2026', true, true
WHERE NOT EXISTS (SELECT 1 FROM academic_years LIMIT 1);

-- ==================== VERIFIKASI ====================
-- Tampilkan struktur tabel untuk verifikasi
SELECT 'academic_years columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'academic_years' ORDER BY ordinal_position;

SELECT 'units columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'units' ORDER BY ordinal_position;
