-- =====================================================
-- FIX: quota_allocations TABLE + UNIQUE CONSTRAINT
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. Buat tabel jika belum ada (dengan semua kolom)
CREATE TABLE IF NOT EXISTS public.quota_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_year TEXT NOT NULL,
    internal INTEGER DEFAULT 0,
    indent_external INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambahkan kolom academic_year jika belum ada
--    (untuk kasus tabel sudah ada tapi dengan struktur lama)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quota_allocations'
          AND column_name = 'academic_year'
    ) THEN
        ALTER TABLE public.quota_allocations ADD COLUMN academic_year TEXT;
    END IF;
END $$;

-- 3. Tambahkan kolom internal jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quota_allocations'
          AND column_name = 'internal'
    ) THEN
        ALTER TABLE public.quota_allocations ADD COLUMN internal INTEGER DEFAULT 0;
    END IF;
END $$;

-- 4. Tambahkan kolom indent_external jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quota_allocations'
          AND column_name = 'indent_external'
    ) THEN
        ALTER TABLE public.quota_allocations ADD COLUMN indent_external INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5. Tambahkan UNIQUE constraint pada academic_year jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'quota_allocations_academic_year_key'
          AND conrelid = 'public.quota_allocations'::regclass
    ) THEN
        ALTER TABLE public.quota_allocations
            ADD CONSTRAINT quota_allocations_academic_year_key
            UNIQUE (academic_year);
    END IF;
END $$;

-- 6. Aktifkan RLS
ALTER TABLE public.quota_allocations ENABLE ROW LEVEL SECURITY;

-- 7. Drop policy lama jika ada
DROP POLICY IF EXISTS "QA readable by all" ON public.quota_allocations;
DROP POLICY IF EXISTS "QA insertable by authenticated" ON public.quota_allocations;
DROP POLICY IF EXISTS "QA updateable by authenticated" ON public.quota_allocations;
DROP POLICY IF EXISTS "QA deletable by authenticated" ON public.quota_allocations;
DROP POLICY IF EXISTS "allow_all_quota_allocations" ON public.quota_allocations;

-- 8. Buat RLS policies
CREATE POLICY "QA readable by all" ON public.quota_allocations
    FOR SELECT USING (true);

CREATE POLICY "QA insertable by authenticated" ON public.quota_allocations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "QA updateable by authenticated" ON public.quota_allocations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "QA deletable by authenticated" ON public.quota_allocations
    FOR DELETE USING (auth.role() = 'authenticated');

-- 9. Grant permissions
GRANT ALL ON public.quota_allocations TO anon, authenticated, service_role;

-- =====================================================
-- DONE! Coba klik "Simpan Target" lagi.
-- =====================================================

