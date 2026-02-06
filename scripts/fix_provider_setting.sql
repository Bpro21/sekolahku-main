-- Check current wa_provider setting
SELECT wa_provider FROM public.app_settings;

-- Fix: Set wa_provider back to 'baileys'
UPDATE public.app_settings 
SET wa_provider = 'baileys';

-- Verify the change
SELECT wa_provider FROM public.app_settings;
