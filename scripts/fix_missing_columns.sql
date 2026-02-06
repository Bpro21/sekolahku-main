-- Add all potential missing columns and refresh cache
-- Try to run this. If it fails with permission, we will know for sure.

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS last_message_preview text,
ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS unread_count integer DEFAULT 0;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
