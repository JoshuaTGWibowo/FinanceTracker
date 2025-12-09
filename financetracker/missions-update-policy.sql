-- Add UPDATE policy for missions to allow refreshing expired missions
-- This allows the system to update mission timeframes when they expire

-- Drop existing SELECT policy to recreate with proper permissions
DROP POLICY IF EXISTS "Active missions are viewable by everyone" ON public.missions;

-- Recreate SELECT policy
CREATE POLICY "Active missions are viewable by everyone"
  ON public.missions FOR SELECT
  USING (is_active = true);

-- Add UPDATE policy for system to refresh missions
-- Note: This allows all authenticated users to update missions
-- In production, consider using a service role or Supabase Function
CREATE POLICY "System can update mission timeframes"
  ON public.missions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for user_missions to allow resetting progress when missions refresh
DROP POLICY IF EXISTS "Users can update own mission progress" ON public.user_missions;

-- Recreate the ALL policy for user_missions
CREATE POLICY "Users can manage own mission progress"
  ON public.user_missions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Alternative: If you want stricter control, use a Supabase Function with service role
-- For now, this allows the app to refresh expired missions and reset user progress
