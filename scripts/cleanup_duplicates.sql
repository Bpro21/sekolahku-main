-- Defensive SQL Cleanup for duplicate leads
-- Keeps the most recent entry for each phone number

DO $$
DECLARE
    dupe_row RECORD;
BEGIN
    FOR dupe_row IN (
        WITH duplicates AS (
            SELECT id, 
                   ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at DESC) as rn
            FROM leads
            WHERE phone IS NOT NULL
        )
        SELECT id FROM duplicates WHERE rn > 1
    ) LOOP
        -- Delete associated conversations (always exists)
        DELETE FROM conversations WHERE lead_id = dupe_row.id;
        
        -- Safely attempt to delete from crm_activities (check if table exists)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_activities') THEN
            EXECUTE 'DELETE FROM crm_activities WHERE lead_id = $1' USING dupe_row.id;
        END IF;

        -- Finally delete the duplicate lead
        DELETE FROM leads WHERE id = dupe_row.id;
    END LOOP;
END $$;
