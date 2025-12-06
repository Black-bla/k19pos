-- Check if menu_items table exists and its structure
-- Run this in Supabase SQL Editor to verify your database schema

-- View menu_items table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'menu_items'
ORDER BY ordinal_position;

-- Check if category column exists and its type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'menu_items' AND column_name = 'category';

-- If the table doesn't exist or category needs to be created, run this:
-- ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category TEXT;

-- To ensure category column exists with proper type:
-- If you need to recreate the table or add the column, use:
/*
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT,
  available BOOLEAN DEFAULT true,
  is_combo BOOLEAN DEFAULT false,
  combo_items TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- Check current menu items
SELECT * FROM menu_items;
