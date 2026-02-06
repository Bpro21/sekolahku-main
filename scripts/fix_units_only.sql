-- =====================================================
-- COMPLETE FIX untuk UNITS table
-- Jalankan di SQL Editor Supabase
-- =====================================================

-- Semua kolom yang dibutuhkan untuk tabel units
ALTER TABLE units ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS quota integer DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS filled integer DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS open boolean DEFAULT true;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_reg bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_rereg bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_spp bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS facilities text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS info_text text;
ALTER TABLE units ADD COLUMN IF NOT EXISTS majors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cost_breakdown jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS fee_breakdown jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS academic_configs jsonb DEFAULT '{}'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS spp_amount bigint DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS spp_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE units ADD COLUMN IF NOT EXISTS active_academic_year_id uuid;
ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_id uuid;
ALTER TABLE units ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Fix id default
ALTER TABLE units ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Disable RLS
ALTER TABLE units DISABLE ROW LEVEL SECURITY;

-- Refresh cache
NOTIFY pgrst, 'reload schema';

-- Verify columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'units' ORDER BY ordinal_position;
