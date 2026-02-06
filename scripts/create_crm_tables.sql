-- =====================================================
-- SCRIPT: CREATE CRM TABLES FOR PSB/PPDB
-- Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. LEADS TABLE (Calon Siswa Potensial)
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text,
    email text,
    parent_name text,
    child_name text,
    child_grade text, -- TK, SD, SMP, SMA
    source text DEFAULT 'manual', -- website, whatsapp, referral, event, instagram, facebook, manual
    status text DEFAULT 'inquiry', -- inquiry, contacted, followup, visit, register, enrolled, lost
    priority text DEFAULT 'medium', -- hot, warm, cold / high, medium, low
    notes text,
    assigned_to text, -- email admin yang handle
    tags jsonb DEFAULT '[]'::jsonb,
    last_contacted_at timestamptz,
    next_followup_at timestamptz,
    lost_reason text,
    academic_year_id text,
    unit_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. CONVERSATIONS TABLE (Riwayat Chat WhatsApp)
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    phone text NOT NULL,
    name text,
    messages jsonb DEFAULT '[]'::jsonb, -- Array of {id, sender, text, timestamp, is_ai, status}
    last_message_at timestamptz DEFAULT now(),
    last_message_preview text,
    status text DEFAULT 'open', -- open, closed, pending, ai_handled
    unread_count integer DEFAULT 0,
    assigned_to text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. AI_TEMPLATES TABLE (Template Auto-Reply)
CREATE TABLE IF NOT EXISTS public.ai_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    trigger_keywords text[], -- kata kunci yang memicu template
    response_template text NOT NULL,
    use_ai boolean DEFAULT false, -- true = pakai Gemini, false = template statis
    category text DEFAULT 'general', -- general, biaya, jadwal, kuota, pendaftaran
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0, -- semakin tinggi = lebih diprioritaskan
    usage_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. CRM_ACTIVITIES TABLE (Log Aktivitas)
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    activity_type text NOT NULL, -- call, whatsapp, email, visit, note, status_change
    description text,
    old_status text,
    new_status text,
    performed_by text, -- email admin
    created_at timestamptz DEFAULT now()
);

-- 5. BROADCAST_CAMPAIGNS TABLE (Kampanye Broadcast)
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    message_template text NOT NULL,
    target_filter jsonb DEFAULT '{}'::jsonb, -- {status: [], source: [], tags: []}
    target_count integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    status text DEFAULT 'draft', -- draft, scheduled, sending, completed, cancelled
    scheduled_at timestamptz,
    completed_at timestamptz,
    created_by text,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (Authenticated users only)
-- =====================================================

-- Leads
DROP POLICY IF EXISTS "Authenticated can manage leads" ON public.leads;
CREATE POLICY "Authenticated can manage leads" ON public.leads
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Conversations
DROP POLICY IF EXISTS "Authenticated can manage conversations" ON public.conversations;
CREATE POLICY "Authenticated can manage conversations" ON public.conversations
    FOR ALL USING (auth.uid() IS NOT NULL);

-- AI Templates
DROP POLICY IF EXISTS "Authenticated can manage ai_templates" ON public.ai_templates;
CREATE POLICY "Authenticated can manage ai_templates" ON public.ai_templates
    FOR ALL USING (auth.uid() IS NOT NULL);

-- CRM Activities
DROP POLICY IF EXISTS "Authenticated can manage crm_activities" ON public.crm_activities;
CREATE POLICY "Authenticated can manage crm_activities" ON public.crm_activities
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Broadcast Campaigns
DROP POLICY IF EXISTS "Authenticated can manage broadcast_campaigns" ON public.broadcast_campaigns;
CREATE POLICY "Authenticated can manage broadcast_campaigns" ON public.broadcast_campaigns
    FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON public.conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id ON public.crm_activities(lead_id);

-- =====================================================
-- INSERT DEFAULT AI TEMPLATES
-- =====================================================

INSERT INTO public.ai_templates (name, trigger_keywords, response_template, use_ai, category, priority) VALUES
('Salam Pembuka', ARRAY['halo', 'hai', 'assalamualaikum', 'permisi', 'selamat'], 
 'Waalaikumsalam Wr. Wb. 👋

Terima kasih telah menghubungi kami!

Saya adalah asisten virtual PSB. Ada yang bisa saya bantu?

1️⃣ Info Pendaftaran
2️⃣ Biaya Sekolah
3️⃣ Jadwal & Kuota
4️⃣ Hubungi Admin

Silakan balas dengan angka atau ketik pertanyaan Anda.', false, 'general', 100),

('Info Biaya', ARRAY['biaya', 'harga', 'bayar', 'uang', 'spp', 'cicilan', 'diskon'],
 'Untuk informasi biaya pendaftaran dan SPP, silakan kunjungi website kami atau hubungi admin langsung.

💰 Tersedia program:
• Cicilan hingga 4x
• Diskon Early Bird
• Beasiswa prestasi

Apakah ingin kami hubungi untuk konsultasi?', false, 'biaya', 90),

('Info Jadwal', ARRAY['jadwal', 'kapan', 'tanggal', 'waktu', 'jam', 'buka'],
 'Jadwal Pendaftaran:
📅 Gelombang 1: Januari - Maret
📅 Gelombang 2: April - Juni

⏰ Jam Operasional:
Senin - Jumat: 08.00 - 15.00
Sabtu: 08.00 - 12.00

Mau daftar sekarang? Klik link berikut untuk mendaftar online.', false, 'jadwal', 80),

('Info Kuota', ARRAY['kuota', 'tersedia', 'penuh', 'sisa', 'slot'],
 'Untuk info kuota terbaru per jenjang dan jurusan, silakan hubungi admin kami.

Kami akan segera menghubungi Anda untuk memberikan informasi lengkap.

Mohon informasikan:
• Nama lengkap
• Jenjang yang diminati (TK/SD/SMP/SMA)
• Nomor WA aktif', false, 'kuota', 70),

('Pertanyaan AI', ARRAY['tanya', 'info', 'bagaimana', 'apa', 'kenapa', 'dimana', 'siapa'],
 '', true, 'general', 10)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DONE! Tabel CRM berhasil dibuat.
-- =====================================================
