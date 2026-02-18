-- Migration to support automatic payment validation
-- File: scripts/add_midtrans_order_id_column.sql

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS midtrans_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_midtrans_order_id ON invoices(midtrans_order_id);
