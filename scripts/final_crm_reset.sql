-- ==========================================
-- STEP 1: REFRESH CACHE (Buka SQL Editor)
-- Jalankan ini agar kolom baru terdeteksi
-- ==========================================

NOTIFY pgrst, 'reload schema';

-- ==========================================
-- STEP 2: FIX RLS (Coba jalankan ini)
-- Jika ini gagal (Error 42501), gunakan UI (Step 3)
-- ==========================================

-- Coba disable RLS sementara untuk test jika permission error
-- ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

-- Tambah policy ALL untuk authenticated (admin dashboard)
DO $$ 
BEGIN
    -- Policy for Conversations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_admin_conv') THEN
        CREATE POLICY "allow_all_admin_conv" ON public.conversations FOR ALL TO authenticated USING (true);
    END IF;

    -- Policy for Leads
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_admin_leads') THEN
        CREATE POLICY "allow_all_admin_leads" ON public.leads FOR ALL TO authenticated USING (true);
    END IF;
END $$;
