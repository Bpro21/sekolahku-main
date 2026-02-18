-- Migration to add missing payment recording columns
-- File: scripts/fix_invoices_missing_columns.sql

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Ensure tracking column also exists (added in previous step but good to be sure)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS midtrans_order_id TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_transaction_id ON invoices(transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoices_midtrans_order_id ON invoices(midtrans_order_id);

-- Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
