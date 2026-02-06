-- =====================================================
-- SCRIPT: CREATE APP_SETTINGS TABLE & INSERT DEFAULT
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. Create app_settings table if not exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    id text PRIMARY KEY DEFAULT 'main',
    school_name text DEFAULT 'Sekolah Islam Terpadu',
    school_address text,
    school_phone text,
    school_email text,
    invoice_footer_note text,
    invoice_prefix text,
    invoice_title text,
    app_name text DEFAULT 'PSB Online',
    app_version text DEFAULT 'v1.0',
    psb_period_id text,
    app_logo text,
    welcome_message text,
    auth_backgrounds jsonb DEFAULT '[]'::jsonb,
    announcement jsonb DEFAULT '{"text": "", "active": false}'::jsonb,
    fonnte_token text,
    committee_head text,
    committee_position text,
    template_graduation text,
    template_reminder text,
    template_payment_reminder text,
    template_document_reminder text,
    admins jsonb DEFAULT '[]'::jsonb,
    app_template text DEFAULT 'berry',
    landing_page jsonb DEFAULT '{}'::jsonb,
    signature_image text,
    finance_head text,
    finance_position text,
    finance_signature text,
    template_installment_t1 text,
    template_installment_t2 text,
    template_installment_t3 text,
    template_installment_t4 text,
    template_otp text,
    gemini_api_key text,
    gemini_model text DEFAULT 'gemini-1.5-flash',
    seo jsonb DEFAULT '{"title": "", "description": "", "keywords": ""}'::jsonb,
    ai_assistant jsonb DEFAULT '{"active": false}'::jsonb,
    quiz_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Allow all authenticated users to read
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
    FOR SELECT USING (true);

-- 4. Allow authenticated users to update/insert (admin check done in app)
DROP POLICY IF EXISTS "Authenticated can manage app_settings" ON public.app_settings;
CREATE POLICY "Authenticated can manage app_settings" ON public.app_settings
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. Insert default row if not exists
INSERT INTO public.app_settings (id, school_name, app_name, admins)
VALUES ('main', 'Sekolah Islam Terpadu', 'PSB Online', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- DONE! Tabel app_settings sudah siap.
-- =====================================================
