-- ================================================================
-- Script LENGKAP untuk menambahkan semua kolom yang hilang di app_settings
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. Tambahkan kolom seo jika belum ada
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS seo jsonb;

-- 2. Tambahkan kolom ai_assistant jika belum ada
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS ai_assistant jsonb;

-- 3. Tambahkan kolom announcement jika belum ada
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS announcement jsonb;

-- 4. Tambahkan kolom landing_page jika belum ada
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS landing_page jsonb;

-- 5. Tambahkan kolom quiz_config jika belum ada (untuk Ujian & AI)
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS quiz_config jsonb;

-- 6. Set nilai default untuk kolom-kolom yang kosong
UPDATE public.app_settings
SET 
    seo = COALESCE(seo, '{
        "title": "",
        "description": "",
        "keywords": "",
        "gtm_id": "",
        "pixel_id": ""
    }'::jsonb),
    
    ai_assistant = COALESCE(ai_assistant, '{
        "active": false,
        "bot_name": "Asisten Sekolah",
        "welcome_msg": "Halo! Ada yang bisa saya bantu?",
        "persona": "Anda adalah Customer Service sekolah yang ramah.",
        "knowledge_base": "",
        "google_gemini_api_key": ""
    }'::jsonb),
    
    announcement = COALESCE(announcement, '{
        "active": false,
        "text": ""
    }'::jsonb),
    
    landing_page = COALESCE(landing_page, '{
        "announcement_bar": "",
        "hero_badge": "",
        "hero_title": "",
        "hero_subtitle": "",
        "hero_btn_text": "Daftar Sekarang",
        "hero_bg": "",
        "brochure_link": "",
        "cta_title": "Jangan Lewatkan Kesempatan Emas Ini!",
        "cta_desc": "Kuota terbatas untuk gelombang pertama.",
        "faq_title": "Pertanyaan Sering Diajukan",
        "faqs": []
    }'::jsonb),
    
    quiz_config = COALESCE(quiz_config, '{
        "gemini_api_key": ""
    }'::jsonb)
    
WHERE id = 'main';

-- 7. Verifikasi hasil
SELECT 
    id, 
    app_name,
    seo IS NOT NULL as has_seo,
    ai_assistant IS NOT NULL as has_ai_assistant,
    announcement IS NOT NULL as has_announcement,
    landing_page IS NOT NULL as has_landing_page,
    quiz_config IS NOT NULL as has_quiz_config
FROM public.app_settings 
WHERE id = 'main';
