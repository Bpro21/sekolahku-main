-- Enable Realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable Realtime for leads table (optional but recommended)
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- Verify Realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('conversations', 'leads');

-- If the above returns empty or error, try creating the publication first:
-- This is only needed if supabase_realtime publication doesn't exist
-- DROP PUBLICATION IF EXISTS supabase_realtime;
-- CREATE PUBLICATION supabase_realtime FOR TABLE conversations, leads;
