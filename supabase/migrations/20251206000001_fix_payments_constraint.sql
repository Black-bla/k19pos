-- Add unique constraint on transaction_id for payments table
ALTER TABLE payments ADD CONSTRAINT payments_transaction_id_unique UNIQUE (transaction_id);
