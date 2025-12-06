-- Supabase Database Schema
-- Run these SQL commands in your Supabase SQL Editor
-- https://app.supabase.com/project/_/sql

-- Enable Row Level Security (RLS) on all tables
-- This ensures users can only access their own data

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (for leaderboard)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- LEADERBOARD STATS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.leaderboard_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  
  -- Anonymized metrics (NO actual transaction amounts)
  savings_percentage NUMERIC(5,2), -- e.g., 20.50 for 20.5%
  budget_adherence_score INTEGER CHECK (budget_adherence_score >= 0 AND budget_adherence_score <= 100),
  streak_days INTEGER DEFAULT 0,
  transactions_logged INTEGER DEFAULT 0,
  
  -- Gamification
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period)
);

ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;

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

-- =====================================================
-- CREWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  max_members INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

-- Crews are viewable by members only (private by default)
CREATE POLICY "Crew members can view their crew"
  ON public.crews FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()
    )
  );

-- Only owner can update crew
CREATE POLICY "Crew owner can update crew"
  ON public.crews FOR UPDATE
  USING (owner_id = auth.uid());

-- Anyone authenticated can create a crew
CREATE POLICY "Authenticated users can create crews"
  ON public.crews FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owner can delete crew
CREATE POLICY "Crew owner can delete crew"
  ON public.crews FOR DELETE
  USING (owner_id = auth.uid());

-- =====================================================
-- CREW MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(crew_id, user_id)
);

ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- Crew members can view other members in their crew
CREATE POLICY "Crew members are viewable by crew members"
  ON public.crew_members FOR SELECT
  USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()
    )
  );

-- Users can join crews (insert)
CREATE POLICY "Users can join crews"
  ON public.crew_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can leave crews (delete their own membership)
CREATE POLICY "Users can leave crews"
  ON public.crew_members FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can update roles
CREATE POLICY "Admins can update member roles"
  ON public.crew_members FOR UPDATE
  USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- MISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL DEFAULT 'individual' CHECK (mission_type IN ('individual', 'crew')),
  
  -- Goal criteria (anonymized - no actual amounts)
  goal_type TEXT NOT NULL CHECK (goal_type IN ('savings_rate', 'streak', 'budget_adherence', 'transactions_logged')),
  goal_target NUMERIC NOT NULL,
  
  -- Rewards
  points_reward INTEGER DEFAULT 0,
  
  -- Timing
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- All users can view active missions
CREATE POLICY "Active missions are viewable by everyone"
  ON public.missions FOR SELECT
  USING (is_active = true);

-- =====================================================
-- USER MISSIONS TABLE (Individual Progress)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, mission_id)
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- Users can view their own mission progress
CREATE POLICY "Users can view own mission progress"
  ON public.user_missions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own mission progress
CREATE POLICY "Users can update own mission progress"
  ON public.user_missions FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- CREW MISSIONS TABLE (Team Progress)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.crew_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(crew_id, mission_id)
);

ALTER TABLE public.crew_missions ENABLE ROW LEVEL SECURITY;

-- Crew members can view their crew's mission progress
CREATE POLICY "Crew members can view crew mission progress"
  ON public.crew_missions FOR SELECT
  USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- ACHIEVEMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  points_value INTEGER DEFAULT 0,
  criteria_type TEXT NOT NULL,
  criteria_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- All users can view achievements
CREATE POLICY "Achievements are viewable by everyone"
  ON public.achievements FOR SELECT
  USING (true);

-- =====================================================
-- USER ACHIEVEMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can view all achievements (to see what others unlocked)
CREATE POLICY "User achievements are viewable by everyone"
  ON public.user_achievements FOR SELECT
  USING (true);

-- Users can only unlock their own achievements
CREATE POLICY "Users can unlock own achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'display_name', 
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(
      EXCLUDED.display_name,
      public.profiles.display_name
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_crews_updated_at
  BEFORE UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_leaderboard_stats_updated_at
  BEFORE UPDATE ON public.leaderboard_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- CREW HELPER FUNCTIONS
-- =====================================================

-- Index for fast invite code lookups
CREATE INDEX IF NOT EXISTS idx_crews_invite_code 
  ON public.crews(invite_code);

-- Function to get crew by invite code
CREATE OR REPLACE FUNCTION public.get_crew_by_invite_code(code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  owner_id UUID,
  invite_code TEXT,
  max_members INTEGER,
  member_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.owner_id,
    c.invite_code,
    c.max_members,
    COUNT(cm.user_id) as member_count,
    c.created_at
  FROM public.crews c
  LEFT JOIN public.crew_members cm ON c.id = cm.crew_id
  WHERE c.invite_code = code
  GROUP BY c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join crew with invite code
CREATE OR REPLACE FUNCTION public.join_crew_with_code(code TEXT)
RETURNS JSON AS $$
DECLARE
  v_crew_id UUID;
  v_current_members INTEGER;
  v_max_members INTEGER;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get crew info
  SELECT id, max_members INTO v_crew_id, v_max_members
  FROM public.crews
  WHERE invite_code = code;
  
  -- Check if crew exists
  IF v_crew_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.crew_members 
    WHERE crew_id = v_crew_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Already a member of this crew');
  END IF;
  
  -- Check if crew is full
  SELECT COUNT(*) INTO v_current_members
  FROM public.crew_members
  WHERE crew_id = v_crew_id;
  
  IF v_current_members >= v_max_members THEN
    RETURN json_build_object('success', false, 'error', 'Crew is full');
  END IF;
  
  -- Add user to crew
  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (v_crew_id, v_user_id, 'member');
  
  RETURN json_build_object('success', true, 'crew_id', v_crew_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's crew
CREATE OR REPLACE FUNCTION public.get_user_crew()
RETURNS TABLE (
  crew_id UUID,
  crew_name TEXT,
  crew_description TEXT,
  invite_code TEXT,
  max_members INTEGER,
  owner_id UUID,
  owner_username TEXT,
  member_count BIGINT,
  user_role TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as crew_id,
    c.name as crew_name,
    c.description as crew_description,
    c.invite_code,
    c.max_members,
    c.owner_id,
    p.username as owner_username,
    COUNT(cm2.user_id) as member_count,
    cm.role as user_role,
    cm.joined_at
  FROM public.crew_members cm
  JOIN public.crews c ON cm.crew_id = c.id
  JOIN public.profiles p ON c.owner_id = p.id
  LEFT JOIN public.crew_members cm2 ON c.id = cm2.crew_id
  WHERE cm.user_id = auth.uid()
  GROUP BY c.id, c.name, c.description, c.invite_code, c.max_members, 
           c.owner_id, p.username, cm.role, cm.joined_at
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get crew members with stats
CREATE OR REPLACE FUNCTION public.get_crew_members(p_crew_id UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  role TEXT,
  total_points INTEGER,
  level INTEGER,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.user_id,
    p.username,
    p.display_name,
    cm.role,
    COALESCE(ls.total_points, 0) as total_points,
    COALESCE(ls.level, 1) as level,
    cm.joined_at
  FROM public.crew_members cm
  JOIN public.profiles p ON cm.user_id = p.id
  LEFT JOIN public.leaderboard_stats ls ON ls.user_id = cm.user_id AND ls.period = 'all_time'
  WHERE cm.crew_id = p_crew_id
  ORDER BY ls.total_points DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert some sample missions
INSERT INTO public.missions (title, description, mission_type, goal_type, goal_target, points_reward, is_active)
VALUES
  ('Savings Streak', 'Maintain a positive savings rate for 7 days', 'individual', 'streak', 7, 100, true),
  ('Budget Master', 'Achieve 90% budget adherence for the month', 'individual', 'budget_adherence', 90, 200, true),
  ('Transaction Logger', 'Log 50 transactions this week', 'individual', 'transactions_logged', 50, 50, true),
  ('Super Saver', 'Achieve 30% savings rate this month', 'individual', 'savings_rate', 30, 300, true);

-- Insert some sample achievements
INSERT INTO public.achievements (title, description, icon, points_value, criteria_type, criteria_value)
VALUES
  ('First Transaction', 'Log your first transaction', '🎉', 10, 'transactions_logged', 1),
  ('Week Warrior', 'Maintain a 7-day streak', '🔥', 50, 'streak', 7),
  ('Month Master', 'Maintain a 30-day streak', '⭐', 200, 'streak', 30),
  ('Budget Pro', 'Achieve 95% budget adherence', '💰', 100, 'budget_adherence', 95),
  ('Super Saver', 'Achieve 50% savings rate', '🏆', 300, 'savings_rate', 50);
