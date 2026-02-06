-- =====================================================
-- SIMPLE FIX: Just fix the ID column default
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- Fix the leads table ID column to have UUID default
ALTER TABLE public.leads 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Fix the conversations table ID column to have UUID default
ALTER TABLE public.conversations 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the fix
SELECT 
    table_name,
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('leads', 'conversations')
AND column_name = 'id';

-- Test insert (will auto-generate UUID)
-- INSERT INTO public.leads (name, phone, source, status) 
-- VALUES ('Test Lead', '1234567890', 'Test', 'inquiry');

-- =====================================================
-- DONE! Sekarang coba kirim pesan WA lagi.
-- =====================================================
