-- Change announcement column type to jsonb
ALTER TABLE public.app_settings 
ALTER COLUMN announcement TYPE jsonb USING announcement::jsonb;

-- If conversion fails (e.g. invalid json text), reset it:
-- ALTER TABLE public.app_settings DROP COLUMN announcement;
-- ALTER TABLE public.app_settings ADD COLUMN announcement jsonb DEFAULT '{"text": "", "active": false}'::jsonb;
