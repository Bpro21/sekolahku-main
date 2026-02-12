-- Create indent_submissions table for Internal Indent Recommendation flow
-- This table stores recommendation document submissions from internal indent registrations
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS indent_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_name TEXT,
    user_email TEXT,
    student_name_candidate TEXT NOT NULL,
    target_unit_id UUID,
    target_unit_name TEXT,
    recommendation_doc TEXT, -- Base64 encoded document
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    admin_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE indent_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own submissions
CREATE POLICY "Users can view own indent submissions" ON indent_submissions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own submissions
CREATE POLICY "Users can insert own indent submissions" ON indent_submissions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions" ON indent_submissions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all submissions (using profiles.role check)
CREATE POLICY "Admins can view all indent submissions" ON indent_submissions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Admins can update any submission (for approval/rejection)
CREATE POLICY "Admins can update indent submissions" ON indent_submissions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE indent_submissions;

-- Create index for faster lookups
CREATE INDEX idx_indent_submissions_user_id ON indent_submissions(user_id);
CREATE INDEX idx_indent_submissions_status ON indent_submissions(status);
