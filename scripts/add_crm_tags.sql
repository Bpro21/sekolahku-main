-- Add Tags and Follow Up tracking to Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_followed_up_at timestamptz;

-- Add CRM Configuration to App Settings (Global Tags & Role Management)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS crm_config jsonb DEFAULT '{
    "tags": ["Hot", "Warm", "Cold", "New Customer", "Followed Up", "Waiting Payment"],
    "admins": []
}'::jsonb;

-- Example of how to add a CRM admin:
-- UPDATE app_settings SET crm_config = jsonb_set(crm_config, '{admins}', '["email@example.com"]');
