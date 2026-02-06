-- Fix academic_years RLS policies and add missing columns
-- This script DOES NOT create tables (to avoid permission errors)
-- Run this in Supabase SQL Editor

-- Step 1: Drop old policies
DROP POLICY IF EXISTS "Enable read access for all users" ON academic_years;
DROP POLICY IF EXISTS "Enable write access for all users" ON academic_years;
DROP POLICY IF EXISTS "academic_years_select" ON academic_years;
DROP POLICY IF EXISTS "academic_years_all" ON academic_years;
DROP POLICY IF EXISTS "public_read" ON academic_years;
DROP POLICY IF EXISTS "Allow all access" ON academic_years;
DROP POLICY IF EXISTS "academic_years_public_select" ON academic_years;
DROP POLICY IF EXISTS "academic_years_authenticated_insert" ON academic_years;
DROP POLICY IF EXISTS "academic_years_authenticated_update" ON academic_years;
DROP POLICY IF EXISTS "academic_years_authenticated_delete" ON academic_years;

-- Step 2: Add missing columns (safe - won't error if column exists)
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS unit_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS indent_enabled boolean DEFAULT false;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS is_indent_open boolean DEFAULT false;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS indent_start_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS indent_end_date date;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 3: Enable RLS
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

-- Step 4: Create new permissive policies
-- Allow everyone to read (public data)
CREATE POLICY "academic_years_public_select" ON academic_years
    FOR SELECT
    USING (true);

-- Allow authenticated users full access
CREATE POLICY "academic_years_authenticated_insert" ON academic_years
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "academic_years_authenticated_update" ON academic_years
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "academic_years_authenticated_delete" ON academic_years
    FOR DELETE
    TO authenticated
    USING (true);

-- Step 5: Insert default academic year if table is empty
INSERT INTO academic_years (year, is_active, is_default, start_date, end_date)
SELECT '2026/2027', true, true, '2026-01-01', '2026-06-30'
WHERE NOT EXISTS (SELECT 1 FROM academic_years LIMIT 1);

-- Step 6: Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Step 7: Verify (optional - shows current data)
SELECT id, year, is_active, is_default FROM academic_years;
