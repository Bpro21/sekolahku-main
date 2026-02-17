-- =====================================================
-- FIX QUESTIONS TABLE SCHEMA
-- Tabel questions mungkin dibuat dengan kolom lama
-- (question_text, correct_answer) tapi kode menggunakan
-- kolom baru (text, correct, religion, level).
-- Script ini menambahkan kolom yang hilang.
-- Jalankan di Supabase SQL Editor.
-- =====================================================

-- Tambah kolom 'text' jika belum ada (alias dari question_text)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='text') THEN
        ALTER TABLE public.questions ADD COLUMN "text" text;
        -- Migrate data dari question_text ke text
        UPDATE public.questions SET "text" = question_text WHERE "text" IS NULL AND question_text IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'correct' jika belum ada (alias dari correct_answer)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='correct') THEN
        ALTER TABLE public.questions ADD COLUMN correct text;
        -- Migrate data dari correct_answer ke correct
        UPDATE public.questions SET correct = correct_answer WHERE correct IS NULL AND correct_answer IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'religion' jika belum ada
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='religion') THEN
        ALTER TABLE public.questions ADD COLUMN religion text DEFAULT 'General';
    END IF;
END $$;

-- Tambah kolom 'level' jika belum ada
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='level') THEN
        ALTER TABLE public.questions ADD COLUMN level text DEFAULT 'SD';
    END IF;
END $$;

-- =====================================================
-- FIX VOUCHERS TABLE SCHEMA
-- Kode menggunakan kolom: code, type, amount, quota,
-- description, active, used
-- Tabel mungkin memiliki nama kolom berbeda.
-- =====================================================

-- Tambah kolom 'type' jika belum ada (discount_type -> type)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='type') THEN
        ALTER TABLE public.vouchers ADD COLUMN type text DEFAULT 'fixed';
        UPDATE public.vouchers SET type = discount_type WHERE type IS NULL AND discount_type IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'amount' jika belum ada (discount_value -> amount)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='amount') THEN
        ALTER TABLE public.vouchers ADD COLUMN amount numeric DEFAULT 0;
        UPDATE public.vouchers SET amount = discount_value WHERE amount IS NULL AND discount_value IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'quota' jika belum ada (max_uses -> quota)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='quota') THEN
        ALTER TABLE public.vouchers ADD COLUMN quota integer DEFAULT 0;
        UPDATE public.vouchers SET quota = max_uses WHERE quota IS NULL AND max_uses IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'description' jika belum ada (name -> description)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='description') THEN
        ALTER TABLE public.vouchers ADD COLUMN description text;
        UPDATE public.vouchers SET description = name WHERE description IS NULL AND name IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'active' jika belum ada (is_active -> active)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='active') THEN
        ALTER TABLE public.vouchers ADD COLUMN active boolean DEFAULT true;
        UPDATE public.vouchers SET active = is_active WHERE active IS NULL AND is_active IS NOT NULL;
    END IF;
END $$;

-- Tambah kolom 'used' jika belum ada (used_count -> used)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='used') THEN
        ALTER TABLE public.vouchers ADD COLUMN used integer DEFAULT 0;
        UPDATE public.vouchers SET used = used_count WHERE used IS NULL AND used_count IS NOT NULL;
    END IF;
END $$;

-- =====================================================
-- FIX WAVES TABLE SCHEMA
-- Kode menggunakan kolom: name, year, start_date, end_date, active
-- Tabel mungkin memiliki nama kolom berbeda (is_active -> active, dll)
-- =====================================================

-- Tambah kolom 'year' jika belum ada
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='waves' AND column_name='year') THEN
        ALTER TABLE public.waves ADD COLUMN year text;
    END IF;
END $$;

-- Tambah kolom 'active' jika belum ada (is_active -> active)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='waves' AND column_name='active') THEN
        ALTER TABLE public.waves ADD COLUMN active boolean DEFAULT true;
        UPDATE public.waves SET active = is_active WHERE active IS NULL AND is_active IS NOT NULL;
    END IF;
END $$;

-- =====================================================
-- FIX QUIZ_CONFIG TABLE SCHEMA
-- Kode menggunakan: time_per_question, psychotest_count, adab_count
-- Tabel memiliki: time_limit_minutes, passing_score, shuffle_questions
-- =====================================================

-- Tambah kolom baru yang dipakai kode
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quiz_config' AND column_name='time_per_question') THEN
        ALTER TABLE public.quiz_config ADD COLUMN time_per_question integer DEFAULT 60;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quiz_config' AND column_name='psychotest_count') THEN
        ALTER TABLE public.quiz_config ADD COLUMN psychotest_count integer DEFAULT 20;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quiz_config' AND column_name='adab_count') THEN
        ALTER TABLE public.quiz_config ADD COLUMN adab_count integer DEFAULT 20;
    END IF;
END $$;

-- =====================================================
-- DONE! Jalankan juga fix_rls_quota_tables.sql jika belum.
-- =====================================================
