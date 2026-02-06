-- DROP tabel lama agar bersih
DROP TABLE IF EXISTS public.ai_templates;

-- CREATE ulang dengan struktur lengkap
CREATE TABLE public.ai_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    name TEXT NOT NULL DEFAULT 'Template Tanpa Nama',
    trigger_keywords TEXT[] DEFAULT '{}',
    response_template TEXT,
    use_ai BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    category TEXT DEFAULT 'general'
);

-- Enable RLS
ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admin Full Access (Select, Insert, Update, Delete)
CREATE POLICY "Admin CRUD AI Templates" ON public.ai_templates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert Default Data agar tidak kosong saat di-load
INSERT INTO public.ai_templates (name, trigger_keywords, response_template, use_ai, priority)
VALUES 
('Tanya Biaya', ARRAY['biaya', 'harga', 'spp', 'uang pangkal'], 'Biaya pendaftaran adalah Rp 200.000, SPP bulanan Rp 500.000. Untuk detail lengkap silakan cek brosur di website.', false, 100),
('Info Syarat', ARRAY['syarat', 'dokumen', 'berkas'], 'Syarat pendaftaran: KK, Akta Kelahiran, dan Pas Foto.', false, 90),
('General AI Helper', ARRAY['tanya', 'info', 'kenapa'], '', true, 50);
