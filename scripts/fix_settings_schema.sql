-- Add missing wa_provider column to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS wa_provider text DEFAULT 'fonnte';

-- Update RLS policies to be sure
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage app_settings" ON public.app_settings;

CREATE POLICY "Authenticated can manage app_settings" ON public.app_settings
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions just in case
GRANT ALL ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
