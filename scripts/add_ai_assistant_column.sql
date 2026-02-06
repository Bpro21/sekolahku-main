-- Script untuk menambahkan kolom ai_assistant ke tabel app_settings
-- Jalankan script ini di SQL Editor Supabase Dashboard

-- Cek apakah kolom sudah ada, jika tidak tambahkan
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS ai_assistant jsonb;

-- Opsional: Set nilai default jika kolom kosong
UPDATE public.app_settings
SET ai_assistant = '{
  "active": false,
  "bot_name": "Asisten Sekolah",
  "welcome_msg": "Halo! Ada yang bisa saya bantu?",
  "persona": "Saya adalah asisten virtual sekolah yang siap membantu.",
  "knowledge_base": "",
  "google_gemini_api_key": ""
}'::jsonb
WHERE id = 'main' AND ai_assistant IS NULL;

-- Verifikasi perubahan
SELECT id, ai_assistant FROM public.app_settings WHERE id = 'main';
