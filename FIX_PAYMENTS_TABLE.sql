-- =========================================
-- FIX: Add missing timestamp columns to payments table
-- =========================================
-- The trigger update_payments_updated_at references updated_at column
-- but it was never created in the original migration
--
-- RUN THIS IN SUPABASE DASHBOARD:
-- 1. Go to: https://supabase.com/dashboard/project/fzcdimeuloecsxoqcmyr/editor
-- 2. Click "SQL Editor" in left sidebar
-- 3. Click "+ New Query"
-- 4. Paste this SQL and click "Run"
-- =========================================

-- Add updated_at column (required by trigger)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_at for completeness
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('updated_at', 'created_at')
ORDER BY column_name;
