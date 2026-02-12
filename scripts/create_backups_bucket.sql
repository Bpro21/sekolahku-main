-- Create backups storage bucket for AdminBackup feature
-- 
-- EASIER METHOD: Create bucket via Supabase Dashboard UI
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New Bucket"
-- 3. Name: backups
-- 4. Public bucket: OFF (uncheck)
-- 5. Click "Create bucket"
-- 
-- That's it! Private buckets already have RLS enabled for authenticated users.

-- ALTERNATIVE: If you want to use SQL, just run this simple query:
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE: Do NOT try to create policies on storage.objects table manually.
-- Supabase manages those automatically for private buckets.
