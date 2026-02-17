-- Add missing columns to payment_config table
ALTER TABLE payment_config 
ADD COLUMN IF NOT EXISTS midtrans_client_key TEXT,
ADD COLUMN IF NOT EXISTS midtrans_server_key TEXT,
ADD COLUMN IF NOT EXISTS midtrans_merchant_id TEXT,
ADD COLUMN IF NOT EXISTS midtrans_mode TEXT DEFAULT 'sandbox';

-- Ensure the 'main' row exists
INSERT INTO payment_config (id, gateway_active, manual_banks, midtrans_mode)
VALUES ('main', 'manual', '[]'::jsonb, 'sandbox')
ON CONFLICT (id) DO NOTHING;
