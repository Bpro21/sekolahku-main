-- =====================================================
-- TRIGGER: AUTO CREATE LEAD FROM REGISTRATION
-- Jalankan ini di SQL Editor
-- =====================================================

-- 1. Buat Function Trigger
CREATE OR REPLACE FUNCTION public.handle_new_registration_lead()
RETURNS TRIGGER AS $$
BEGIN
    -- Masukkan data ke tabel leads
    INSERT INTO public.leads (
        name,
        phone,
        email,
        child_name,
        child_grade,
        source,
        status,
        notes,
        created_at,
        updated_at
    )
    VALUES (
        NEW.parent_name,   -- Nama Ortu sebagai nama Lead
        NEW.whatsapp_number,
        NEW.email,
        NEW.student_name,
        NEW.grade_level,   -- Jenjang (TK/SD/SMP)
        'Website Register', -- Source otomatis
        'register',        -- Langsung masuk stage 'Mendaftar'
        'Auto-generated from Registration Form',
        NOW(),
        NOW()
    )
    ON CONFLICT DO NOTHING; -- Hindari duplikat jika logic lain sudah handle

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Pasang Trigger ke Tabel registrations
DROP TRIGGER IF EXISTS on_registration_created_lead ON public.registrations;
CREATE TRIGGER on_registration_created_lead
    AFTER INSERT ON public.registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_registration_lead();

-- =====================================================
-- OPTIONAL: BACKFILL (Tarik data lama)
-- Uncomment baris bawah jika ingin menarik pendaftar yg sudah ada
-- =====================================================
-- INSERT INTO public.leads (name, phone, email, child_name, child_grade, source, status)
-- SELECT parent_name, whatsapp_number, email, student_name, grade_level, 'Website Register', 'register'
-- FROM public.registrations
-- WHERE whatsapp_number NOT IN (SELECT phone FROM public.leads WHERE phone IS NOT NULL);
