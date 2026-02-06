-- Check if Realtime is enabled for conversations table
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE tablename IN ('conversations', 'leads');

-- Check all publications
SELECT * FROM pg_publication;

-- Check table owner
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename IN ('conversations', 'leads');
