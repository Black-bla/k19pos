-- Fix: Add updated_at column to payments table
-- The trigger update_payments_updated_at references this column but it was never created

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Also add created_at if missing for completeness
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
