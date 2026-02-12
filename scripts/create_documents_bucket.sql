-- Create documents bucket for storing uploaded files
-- Run this in Supabase SQL Editor

-- Create bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 52428800)  -- 50MB limit
ON CONFLICT (id) DO NOTHING;

-- OR create via Dashboard:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New Bucket"
-- 3. Name: documents
-- 4. Public: OFF (private)
-- 5. File size limit: 50MB
-- 6. Click Create

-- After creating bucket via Dashboard, add these policies:

-- Policy: Users can upload their own documents
CREATE POLICY "Users can upload documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can view their own documents
CREATE POLICY "Users can view own documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Admins can view all documents
CREATE POLICY "Admins can view all documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents' 
        AND (
            auth.jwt() ->> 'email' LIKE '%@bilal.com'
            OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    );

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
