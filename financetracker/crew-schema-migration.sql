-- Crew Feature Migration - Add invite_code and helper functions
-- Run this in Supabase SQL Editor

-- =====================================================
-- UPDATE CREWS TABLE - Add invite_code column
-- =====================================================

-- Add invite_code column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crews' AND column_name = 'invite_code'
  ) THEN
    ALTER TABLE public.crews 
    ADD COLUMN invite_code TEXT UNIQUE NOT NULL DEFAULT '';
  END IF;
END $$;

-- Update is_public default to false
ALTER TABLE public.crews 
ALTER COLUMN is_public SET DEFAULT false;

-- Create index for fast invite code lookups
CREATE INDEX IF NOT EXISTS idx_crews_invite_code 
  ON public.crews(invite_code);

-- =====================================================
-- UPDATE RLS POLICIES FOR PRIVATE CREWS
-- =====================================================

-- Drop old public policy
DROP POLICY IF EXISTS "Public crews are viewable by everyone" ON public.crews;

-- Create new private policy
CREATE POLICY "Crew members can view their crew"
  ON public.crews FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- CREW HELPER FUNCTIONS
-- =====================================================

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
-- DONE!
-- =====================================================
-- After running this, your crew feature will be ready to use
