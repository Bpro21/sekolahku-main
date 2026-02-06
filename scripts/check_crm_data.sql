-- Check if data exists in leads and conversations tables
SELECT 'LEADS TABLE:' as info;
SELECT id, name, phone, source, status, created_at 
FROM public.leads 
ORDER BY created_at DESC 
LIMIT 10;

SELECT 'CONVERSATIONS TABLE:' as info;
SELECT id, lead_id, status, last_message_preview, unread_count, created_at 
FROM public.conversations 
ORDER BY created_at DESC 
LIMIT 10;

-- Check RLS policies
SELECT 'RLS POLICIES:' as info;
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies 
WHERE tablename IN ('leads', 'conversations')
ORDER BY tablename, policyname;
