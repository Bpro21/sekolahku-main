-- Clean up malformed JIDs in leads and conversations
-- Specifically addressing LID accounts that might have @lid@s.whatsapp.net

-- 1. Fix leads table
UPDATE leads 
SET phone = REPLACE(phone, '@s.whatsapp.net', '') 
WHERE phone LIKE '%@lid@s.whatsapp.net';

-- 2. Fix conversations table
UPDATE conversations 
SET phone = REPLACE(phone, '@s.whatsapp.net', '') 
WHERE phone LIKE '%@lid@s.whatsapp.net';

-- 3. Optimization: ensure LID accounts have their full domain if they don't
UPDATE leads 
SET phone = phone || '@lid'
WHERE phone NOT LIKE '%@%' AND EXISTS (
    SELECT 1 FROM conversations WHERE conversations.lead_id = leads.id AND conversations.phone LIKE '%@lid'
);
