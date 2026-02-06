-- Add phone column to conversations to avoid join issues
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS phone text;

-- Update existing conversations with phone numbers from leads
UPDATE conversations
SET phone = leads.phone
FROM leads
WHERE conversations.lead_id = leads.id
AND conversations.phone IS NULL;

-- Ensure leads phone is unique to prevent duplicates at the DB level
-- This might fail if duplicates already exist, so run cleanup_duplicates.sql first!
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
