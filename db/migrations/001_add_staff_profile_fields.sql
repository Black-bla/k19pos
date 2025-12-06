-- Add avatar_url and phone columns to staff_profiles
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Optionally add index on phone
CREATE INDEX IF NOT EXISTS idx_staff_profiles_phone ON public.staff_profiles (phone);
