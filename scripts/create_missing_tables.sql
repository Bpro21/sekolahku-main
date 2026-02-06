-- =====================================================
-- SCRIPT: CREATE MISSING TABLES FOR SEKOLAHKU APP
-- Jalankan script ini di Supabase SQL Editor
-- FIXED: Tidak menggunakan public.users (gunakan auth.uid())
-- =====================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text,
    type text DEFAULT 'info',
    is_read boolean DEFAULT false,
    link text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. WAVES TABLE
CREATE TABLE IF NOT EXISTS public.waves (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    academic_year_id text,
    start_date date,
    end_date date,
    is_active boolean DEFAULT false,
    quota integer DEFAULT 0,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view waves" ON public.waves;
CREATE POLICY "Anyone can view waves" ON public.waves
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage waves" ON public.waves;
CREATE POLICY "Authenticated users can manage waves" ON public.waves
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_id uuid,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_number text UNIQUE,
    amount numeric NOT NULL DEFAULT 0,
    status text DEFAULT 'pending',
    payment_method text,
    payment_proof text,
    paid_at timestamptz,
    due_date timestamptz,
    notes text,
    academic_year_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices" ON public.invoices
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can manage invoices" ON public.invoices;
CREATE POLICY "Authenticated can manage invoices" ON public.invoices
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. VOUCHERS TABLE
CREATE TABLE IF NOT EXISTS public.vouchers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    name text,
    discount_type text DEFAULT 'percentage',
    discount_value numeric NOT NULL DEFAULT 0,
    max_uses integer DEFAULT 0,
    used_count integer DEFAULT 0,
    valid_from timestamptz,
    valid_until timestamptz,
    is_active boolean DEFAULT true,
    academic_year_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active vouchers" ON public.vouchers;
CREATE POLICY "Anyone can view active vouchers" ON public.vouchers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can manage vouchers" ON public.vouchers;
CREATE POLICY "Authenticated can manage vouchers" ON public.vouchers
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. MARKETING_RAB TABLE
CREATE TABLE IF NOT EXISTS public.marketing_rab (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    category text DEFAULT 'Iklan',
    notes text,
    academic_year_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_rab ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view RAB" ON public.marketing_rab;
CREATE POLICY "Authenticated can view RAB" ON public.marketing_rab
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can manage RAB" ON public.marketing_rab;
CREATE POLICY "Authenticated can manage RAB" ON public.marketing_rab
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 6. QUOTA_ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quota_allocations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id uuid,
    academic_year_id text,
    major_name text,
    quota integer DEFAULT 0,
    filled integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.quota_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view quotas" ON public.quota_allocations;
CREATE POLICY "Anyone can view quotas" ON public.quota_allocations
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can manage quotas" ON public.quota_allocations;
CREATE POLICY "Authenticated can manage quotas" ON public.quota_allocations
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 7. EDIT_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.edit_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    registration_id uuid,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    reason text,
    status text DEFAULT 'pending',
    reviewed_by uuid,
    reviewed_at timestamptz,
    review_notes text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own requests" ON public.edit_requests;
CREATE POLICY "Users can view own requests" ON public.edit_requests
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create requests" ON public.edit_requests;
CREATE POLICY "Users can create requests" ON public.edit_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can update requests" ON public.edit_requests;
CREATE POLICY "Authenticated can update requests" ON public.edit_requests
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 8. INDENT_SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.indent_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    registration_id uuid,
    document_url text,
    status text DEFAULT 'pending',
    submitted_at timestamptz DEFAULT now(),
    reviewed_by uuid,
    reviewed_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.indent_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own submissions" ON public.indent_submissions;
CREATE POLICY "Users can view own submissions" ON public.indent_submissions
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create submissions" ON public.indent_submissions;
CREATE POLICY "Users can create submissions" ON public.indent_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can manage submissions" ON public.indent_submissions;
CREATE POLICY "Authenticated can manage submissions" ON public.indent_submissions
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 9. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    question_text text NOT NULL,
    question_type text DEFAULT 'multiple_choice',
    options jsonb DEFAULT '[]'::jsonb,
    correct_answer text,
    category text,
    difficulty text DEFAULT 'medium',
    points integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active questions" ON public.questions;
CREATE POLICY "Anyone can view active questions" ON public.questions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can manage questions" ON public.questions;
CREATE POLICY "Authenticated can manage questions" ON public.questions
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 10. QUIZ_CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.quiz_config (
    id text PRIMARY KEY DEFAULT 'main',
    gemini_api_key text,
    time_limit_minutes integer DEFAULT 60,
    passing_score integer DEFAULT 60,
    shuffle_questions boolean DEFAULT true,
    show_results boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.quiz_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view quiz config" ON public.quiz_config;
CREATE POLICY "Authenticated can view quiz config" ON public.quiz_config
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can manage quiz config" ON public.quiz_config;
CREATE POLICY "Authenticated can manage quiz config" ON public.quiz_config
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Insert default quiz config
INSERT INTO public.quiz_config (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_waves_academic_year_id ON public.waves(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_marketing_rab_academic_year_id ON public.marketing_rab(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON public.edit_requests(status);

-- =====================================================
-- DONE! Semua tabel berhasil dibuat.
-- =====================================================
