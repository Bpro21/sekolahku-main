-- Fix RLS violations for app_settings
-- The error "new row violates row-level security policy" usually means INSERT permission is missing, 
-- even during an UPSERT operation if RLS checks are strict.

-- 1. Drop strict policies if they exist (clean slate for this table's write access)
DROP POLICY IF EXISTS "Settings updateable by authenticated" ON public.app_settings;
DROP POLICY IF EXISTS "Settings insertable by authenticated" ON public.app_settings;
DROP POLICY IF EXISTS "Settings modify by authenticated" ON public.app_settings;

-- 2. Create permissive policies for Authenticated users
-- Allow INSERT
CREATE POLICY "Settings insertable by authenticated" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow UPDATE
CREATE POLICY "Settings updateable by authenticated" 
ON public.app_settings 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- (Optional) Allow DELETE if needed, usually not for settings
-- CREATE POLICY "Settings deletable by authenticated" ON public.app_settings FOR DELETE USING (auth.role() = 'authenticated');
