-- Add buttons column to ai_templates for interactive message support
ALTER TABLE ai_templates ADD COLUMN IF NOT EXISTS buttons jsonb;

-- Example of button structure:
-- [
--   {"id": "btn_sd", "text": "SD (Sekolah Dasar)"},
--   {"id": "btn_smp", "text": "SMP"},
--   {"id": "btn_sma", "text": "SMA"},
--   {"id": "btn_smk", "text": "SMK"}
-- ]

COMMENT ON COLUMN ai_templates.buttons IS 'JSON array of button objects with id and text for interactive WhatsApp messages';
