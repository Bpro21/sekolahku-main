-- =====================================================
-- COMPLETE FIX: Schema + RLS for CRM Tables
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. DROP EXISTING TABLES (HATI-HATI: Ini akan hapus semua data!)
-- Uncomment jika ingin mulai dari awal
-- DROP TABLE IF EXISTS public.conversations CASCADE;
-- DROP TABLE IF EXISTS public.leads CASCADE;

-- 2. CREATE TABLES WITH PROPER SCHEMA
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text UNIQUE NOT NULL,
    email text,
    source text DEFAULT 'Manual',
    status text DEFAULT 'inquiry',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    status text DEFAULT 'open',
    messages jsonb DEFAULT '[]'::jsonb,
    last_message_preview text,
    last_message_at timestamptz DEFAULT now(),
    unread_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. DISABLE RLS TEMPORARILY
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

-- 4. DROP ALL EXISTING POLICIES
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('leads', 'conversations')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 5. RE-ENABLE RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 6. CREATE SIMPLE ALLOW-ALL POLICIES
CREATE POLICY "allow_all_leads" ON public.leads
    FOR ALL 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "allow_all_conversations" ON public.conversations
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- 7. GRANT ALL PERMISSIONS
GRANT ALL ON public.leads TO anon, authenticated, service_role;
GRANT ALL ON public.conversations TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 8. VERIFY
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('leads', 'conversations');

SELECT 'Policies created:' as status;
SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('leads', 'conversations');

-- =====================================================
-- DONE! Sekarang coba kirim pesan WA lagi.
-- =====================================================
