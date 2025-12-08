-- Points and Leveling System Migration
-- Ensures leaderboard_stats table exists and adds helper functions

-- =====================================================
-- ENSURE LEADERBOARD_STATS TABLE EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.leaderboard_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  
  -- Anonymized metrics (NO actual transaction amounts)
  savings_percentage NUMERIC(5,2),
  budget_adherence_score INTEGER CHECK (budget_adherence_score >= 0 AND budget_adherence_score <= 100),
  streak_days INTEGER DEFAULT 0,
  transactions_logged INTEGER DEFAULT 0,
  
  -- Gamification
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period)
);

-- Enable RLS
ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Leaderboard stats are viewable by everyone" ON public.leaderboard_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.leaderboard_stats;

-- Users can view all leaderboard stats
CREATE POLICY "Leaderboard stats are viewable by everyone"
  ON public.leaderboard_stats FOR SELECT
  USING (true);

-- Users can only insert/update their own stats
CREATE POLICY "Users can update own stats"
  ON public.leaderboard_stats FOR ALL
  USING (auth.uid() = user_id);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_stats_period_points 
  ON public.leaderboard_stats(period, total_points DESC);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_stats_user_period
  ON public.leaderboard_stats(user_id, period);

-- =====================================================
-- HELPER FUNCTION: Initialize user stats
-- =====================================================

CREATE OR REPLACE FUNCTION public.initialize_user_stats(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Create default stats for all periods if they don't exist
  INSERT INTO public.leaderboard_stats (user_id, period, total_points, level, streak_days, transactions_logged)
  VALUES 
    (p_user_id, 'all_time', 0, 1, 0, 0),
    (p_user_id, 'monthly', 0, 1, 0, 0),
    (p_user_id, 'weekly', 0, 1, 0, 0),
    (p_user_id, 'daily', 0, 1, 0, 0)
  ON CONFLICT (user_id, period) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Auto-initialize stats on profile creation
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.initialize_user_stats(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_init_stats ON public.profiles;

-- Create trigger to initialize stats when profile is created
CREATE TRIGGER on_profile_created_init_stats
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_stats();

-- =====================================================
-- HELPER FUNCTION: Get user's current stats
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_stats(
  p_user_id UUID DEFAULT NULL,
  p_period TEXT DEFAULT 'all_time'
)
RETURNS TABLE (
  total_points INTEGER,
  level INTEGER,
  streak_days INTEGER,
  transactions_logged INTEGER,
  savings_percentage NUMERIC,
  budget_adherence_score INTEGER
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Ensure stats exist
  PERFORM public.initialize_user_stats(v_user_id);
  
  RETURN QUERY
  SELECT 
    ls.total_points,
    ls.level,
    ls.streak_days,
    ls.transactions_logged,
    ls.savings_percentage,
    ls.budget_adherence_score
  FROM public.leaderboard_stats ls
  WHERE ls.user_id = v_user_id
    AND ls.period = p_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Award points to user
-- =====================================================

CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_points INTEGER,
  p_period TEXT DEFAULT 'all_time'
)
RETURNS JSON AS $$
DECLARE
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_old_level INTEGER;
  v_leveled_up BOOLEAN;
BEGIN
  -- Ensure stats exist
  PERFORM public.initialize_user_stats(p_user_id);
  
  -- Get current level
  SELECT level INTO v_old_level
  FROM public.leaderboard_stats
  WHERE user_id = p_user_id AND period = p_period;
  
  -- Update points
  UPDATE public.leaderboard_stats
  SET 
    total_points = total_points + p_points,
    updated_at = NOW()
  WHERE user_id = p_user_id AND period = p_period
  RETURNING total_points INTO v_new_total;
  
  -- Calculate new level (exponential: Level N = 100 * 2^(N-1) points)
  v_new_level := 1;
  WHILE (100 * (2 ^ (v_new_level - 1))) <= v_new_total LOOP
    v_new_level := v_new_level + 1;
  END LOOP;
  
  -- Update level if changed
  IF v_new_level != v_old_level THEN
    UPDATE public.leaderboard_stats
    SET level = v_new_level
    WHERE user_id = p_user_id AND period = p_period;
    v_leveled_up := true;
  ELSE
    v_leveled_up := false;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'new_total', v_new_total,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INITIALIZE EXISTING USERS
-- =====================================================

-- Initialize stats for all existing users who don't have them
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM public.profiles LOOP
    PERFORM public.initialize_user_stats(profile_record.id);
  END LOOP;
  RAISE NOTICE 'Initialized stats for all existing users';
END $$;

-- =====================================================
-- DONE!
-- =====================================================
-- Run this migration in Supabase SQL Editor to:
-- 1. Ensure leaderboard_stats table exists
-- 2. Create helper functions for points and levels
-- 3. Auto-initialize stats for new users
-- 4. Initialize stats for all existing users
