-- Diagnose ownership and permissions
SELECT 
    schemaname, 
    tablename, 
    tableowner,
    has_table_privilege(tablename, 'SELECT') as can_select,
    has_table_privilege(tablename, 'INSERT') as can_insert,
    has_table_privilege(tablename, 'UPDATE') as can_update,
    has_table_privilege(tablename, 'DELETE') as can_delete,
    has_table_privilege(tablename, 'TRIGGER') as can_trigger,
    has_table_privilege(tablename, 'TRUNCATE') as can_truncate,
    has_table_privilege(tablename, 'REFERENCES') as can_references
FROM pg_tables 
WHERE tablename IN ('leads', 'conversations');

-- Check current policies again specifically
SELECT * FROM pg_policies WHERE tablename IN ('leads', 'conversations');

-- Check current user
SELECT current_user, session_user;
