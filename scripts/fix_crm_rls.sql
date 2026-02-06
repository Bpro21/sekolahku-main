-- =====================================================
-- FIX RLS POLICIES FOR CRM TABLES (leads & conversations)
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. CREATE LEADS TABLE IF NOT EXISTS
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

-- 2. CREATE CONVERSATIONS TABLE IF NOT EXISTS
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

-- 3. ENABLE RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 4. DROP EXISTING POLICIES (to avoid conflicts)
DROP POLICY IF EXISTS "Allow all for service role" ON public.leads;
DROP POLICY IF EXISTS "Allow all for service role" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can manage conversations" ON public.conversations;

-- 5. CREATE NEW POLICIES - ALLOW SERVICE ROLE (for wa-server.js)
CREATE POLICY "Allow all for service role" ON public.leads
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON public.conversations
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. ALSO ALLOW AUTHENTICATED USERS (for frontend)
CREATE POLICY "Authenticated can manage leads" ON public.leads
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated can manage conversations" ON public.conversations
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 7. GRANT PERMISSIONS
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.conversations TO authenticated;

-- =====================================================
-- DONE! Coba kirim pesan WA lagi setelah ini.
-- =====================================================
