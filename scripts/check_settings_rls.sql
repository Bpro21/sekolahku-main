
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename = 'app_settings';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_settings';
