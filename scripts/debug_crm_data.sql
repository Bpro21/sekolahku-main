-- Check what data is actually in the database
SELECT 'LEADS:' as section;
SELECT id, name, phone, source, created_at 
FROM public.leads 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'CONVERSATIONS:' as section;
SELECT 
    c.id,
    c.lead_id,
    l.name as lead_name,
    l.phone,
    c.status,
    c.last_message_preview,
    c.unread_count,
    jsonb_array_length(c.messages) as message_count,
    c.created_at
FROM public.conversations c
LEFT JOIN public.leads l ON c.lead_id = l.id
ORDER BY c.created_at DESC
LIMIT 5;

SELECT 'SAMPLE MESSAGES:' as section;
SELECT 
    c.id as conversation_id,
    l.phone,
    c.messages
FROM public.conversations c
LEFT JOIN public.leads l ON c.lead_id = l.id
ORDER BY c.created_at DESC
LIMIT 1;
