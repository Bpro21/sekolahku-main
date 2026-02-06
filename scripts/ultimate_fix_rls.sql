-- =====================================================
-- ULTIMATE FIX: RLS POLICIES FOR CRM TABLES
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. DISABLE RLS TEMPORARILY
ALTER TABLE IF EXISTS public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL EXISTING POLICIES
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename IN ('leads', 'conversations')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.leads';
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.conversations';
    END LOOP;
END $$;

-- 3. RE-ENABLE RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 4. CREATE SIMPLE ALLOW-ALL POLICIES
CREATE POLICY "allow_all_leads" ON public.leads
    FOR ALL 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "allow_all_conversations" ON public.conversations
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- 5. GRANT ALL PERMISSIONS
GRANT ALL ON public.leads TO anon, authenticated, service_role;
GRANT ALL ON public.conversations TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- =====================================================
-- DONE! Coba kirim pesan WA lagi.
-- =====================================================
