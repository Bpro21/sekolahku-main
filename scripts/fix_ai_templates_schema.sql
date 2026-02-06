-- Menambahkan kolom 'name' ke tabel ai_templates jika belum ada
ALTER TABLE public.ai_templates 
ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Template Baru';

-- Update RLS jika perlu (sebenarnya tidak perlu update policy kalau cuma nambah kolom)
-- Pastikan authenticated user bisa akses
GRANT ALL ON public.ai_templates TO authenticated;
