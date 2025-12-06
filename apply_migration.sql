-- Add status column to guest_orders table for kitchen order tracking
ALTER TABLE guest_orders 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'preparing', 'ready', 'served'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_guest_orders_status ON guest_orders(status);

-- Add comment for documentation
COMMENT ON COLUMN guest_orders.status IS 'Order status for kitchen tracking: pending (just ordered), preparing (chef started), ready (ready to serve), served (delivered to guest)';
