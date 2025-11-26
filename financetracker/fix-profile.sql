-- Emergency Fix: Manually Create Your Profile
-- Run this in Supabase SQL Editor if the auto-trigger didn't work

-- First, check if your profile exists
SELECT * FROM public.profiles WHERE id = auth.uid();

-- If it doesn't exist, create it manually
-- Replace the username with your desired username
INSERT INTO public.profiles (id, username, display_name)
VALUES (
  auth.uid(),
  'Josh77',  -- Change this to your preferred username
  'Joshua Wibowo'  -- Change this to your display name
)
ON CONFLICT (id) DO NOTHING;

-- Verify it was created
SELECT * FROM public.profiles WHERE id = auth.uid();
