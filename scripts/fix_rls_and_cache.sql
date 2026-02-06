-- ==========================================
-- ULTIMATE CRM FIX: RLS & Schema Cache
-- ==========================================

-- 1. Refresh PostgREST Schema Cache
-- Ini memaksa Supabase untuk mengenali kolom baru 'last_message_preview'
NOTIFY pgrst, 'reload schema';

-- 2. Pastikan RLS Aktif
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 3. Hapus Policy Lama (agar bersih)
DROP POLICY IF EXISTS "Service role can do everything" ON public.leads;
DROP POLICY IF EXISTS "Service role can do everything" ON public.conversations;
DROP POLICY IF EXISTS "Users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;

-- 4. Buat Policy Baru yang Terstruktur

-- LEADS:
-- Service role (untuk wa-server)
CREATE POLICY "service_role_all" ON public.leads 
FOR ALL USING (auth.role() = 'service_role');

-- Authenticated (untuk Dashboard Admin)
CREATE POLICY "authenticated_all" ON public.leads 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CONVERSATIONS:
-- Service role (untuk wa-server)
CREATE POLICY "service_role_all" ON public.conversations 
FOR ALL USING (auth.role() = 'service_role');

-- Authenticated (untuk Dashboard Admin - Kirim Pesan)
CREATE POLICY "authenticated_all" ON public.conversations 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Grant Permissions (Double Check)
GRANT ALL ON public.leads TO service_role, authenticated;
GRANT ALL ON public.conversations TO service_role, authenticated;

-- 6. Verify Columns (Check if columns exist)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name IN ('last_message_preview', 'last_message_at', 'unread_count');
