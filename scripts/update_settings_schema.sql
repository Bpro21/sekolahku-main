
-- Add missing columns to app_settings
alter table public.app_settings 
add column if not exists school_address text,
add column if not exists school_phone text,
add column if not exists school_email text,
add column if not exists committee_head text,
add column if not exists committee_position text,
add column if not exists signature_image text,
add column if not exists template_graduation text,
add column if not exists finance_head text,
add column if not exists finance_position text,
add column if not exists finance_signature text,
add column if not exists invoice_title text,
add column if not exists invoice_prefix text,
add column if not exists invoice_footer_note text,
add column if not exists gemini_api_key text,
add column if not exists gemini_model text,
add column if not exists notification_templates jsonb; 
-- notification_templates will store all the template_* fields to keep it cleaner, or we can add them individually. 
-- Let's add them individually to match the flat structure if preferred, but JSONB is cleaner for templates.
-- Actually the user code uses flat structure. Let's stick to flat or use a 'config' jsonb for everything else.
-- Let's add specific columns for the important ones involved in logic, others in a jsonb? 
-- The user code `settings.template_otp` etc.
-- Let's just add the text columns, it's safer for querying if needed, though JSONB is fine too.
-- Let's add them as text for simplicity in migration script mapping.

alter table public.app_settings
add column if not exists template_reminder text,
add column if not exists template_payment_reminder text,
add column if not exists template_document_reminder text,
add column if not exists template_installment_t1 text,
add column if not exists template_installment_t2 text,
add column if not exists template_installment_t3 text,
add column if not exists template_installment_t4 text;
