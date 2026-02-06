
-- Update app_settings table to include missing fields
alter table public.app_settings 
add column if not exists app_version text,
add column if not exists app_template text,
add column if not exists seo jsonb,
add column if not exists ai_assistant jsonb,
add column if not exists announcement jsonb;
