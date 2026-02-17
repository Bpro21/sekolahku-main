-- =====================================================
-- FIX RLS POLICIES FOR QUOTA-RELATED TABLES
-- Jalankan script ini di Supabase SQL Editor jika masih
-- mendapat error "violates row-level security policy"
-- saat menyimpan data kuota, gelombang, atau tahun akademik.
-- =====================================================

-- ========== TABLE: units ==========
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Units readable by all" ON public.units;
DROP POLICY IF EXISTS "Units insertable by authenticated" ON public.units;
DROP POLICY IF EXISTS "Units updateable by authenticated" ON public.units;
DROP POLICY IF EXISTS "Units deletable by authenticated" ON public.units;
DROP POLICY IF EXISTS "allow_all_units" ON public.units;

CREATE POLICY "Units readable by all" ON public.units
    FOR SELECT USING (true);

CREATE POLICY "Units insertable by authenticated" ON public.units
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Units updateable by authenticated" ON public.units
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Units deletable by authenticated" ON public.units
    FOR DELETE USING (auth.role() = 'authenticated');

-- ========== TABLE: waves ==========
ALTER TABLE IF EXISTS public.waves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Waves readable by all" ON public.waves;
DROP POLICY IF EXISTS "Waves insertable by authenticated" ON public.waves;
DROP POLICY IF EXISTS "Waves updateable by authenticated" ON public.waves;
DROP POLICY IF EXISTS "Waves deletable by authenticated" ON public.waves;
DROP POLICY IF EXISTS "allow_all_waves" ON public.waves;

CREATE POLICY "Waves readable by all" ON public.waves
    FOR SELECT USING (true);

CREATE POLICY "Waves insertable by authenticated" ON public.waves
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Waves updateable by authenticated" ON public.waves
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Waves deletable by authenticated" ON public.waves
    FOR DELETE USING (auth.role() = 'authenticated');

-- ========== TABLE: academic_years ==========
ALTER TABLE IF EXISTS public.academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AY readable by all" ON public.academic_years;
DROP POLICY IF EXISTS "AY insertable by authenticated" ON public.academic_years;
DROP POLICY IF EXISTS "AY updateable by authenticated" ON public.academic_years;
DROP POLICY IF EXISTS "AY deletable by authenticated" ON public.academic_years;
DROP POLICY IF EXISTS "allow_all_academic_years" ON public.academic_years;

CREATE POLICY "AY readable by all" ON public.academic_years
    FOR SELECT USING (true);

CREATE POLICY "AY insertable by authenticated" ON public.academic_years
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "AY updateable by authenticated" ON public.academic_years
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "AY deletable by authenticated" ON public.academic_years
    FOR DELETE USING (auth.role() = 'authenticated');

-- ========== TABLE: indent_settings ==========
ALTER TABLE IF EXISTS public.indent_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Indent readable by all" ON public.indent_settings;
DROP POLICY IF EXISTS "Indent insertable by authenticated" ON public.indent_settings;
DROP POLICY IF EXISTS "Indent updateable by authenticated" ON public.indent_settings;
DROP POLICY IF EXISTS "allow_all_indent_settings" ON public.indent_settings;

CREATE POLICY "Indent readable by all" ON public.indent_settings
    FOR SELECT USING (true);

CREATE POLICY "Indent insertable by authenticated" ON public.indent_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Indent updateable by authenticated" ON public.indent_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ========== GRANT PERMISSIONS ==========
GRANT ALL ON public.units TO anon, authenticated, service_role;
GRANT ALL ON public.waves TO anon, authenticated, service_role;
GRANT ALL ON public.academic_years TO anon, authenticated, service_role;
GRANT ALL ON public.indent_settings TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- =====================================================
-- DONE! Coba simpan pengaturan kuota lagi.
-- =====================================================
