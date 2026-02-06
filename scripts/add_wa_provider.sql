-- Add wa_provider column to app_settings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'wa_provider') THEN
        ALTER TABLE app_settings ADD COLUMN wa_provider text DEFAULT 'fonnte';
    END IF;
END $$;
