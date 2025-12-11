-- Fix Crew RLS Policies - Remove Infinite Recursion
-- Run this in Supabase SQL Editor to fix the policy error

-- =====================================================
-- FIX CREW_MEMBERS POLICIES (Remove recursion)
-- =====================================================

-- Drop all existing policies on crew_members
DROP POLICY IF EXISTS "Crew members are viewable by crew members" ON public.crew_members;
DROP POLICY IF EXISTS "Users can join crews" ON public.crew_members;
DROP POLICY IF EXISTS "Users can leave crews" ON public.crew_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.crew_members;
DROP POLICY IF EXISTS "Allow authenticated users to view crew members" ON public.crew_members;
DROP POLICY IF EXISTS "Crew owners can remove members" ON public.crew_members;

-- Create simple, non-recursive policies
-- Allow users to view crew_members (needed for crew queries)
CREATE POLICY "Allow authenticated users to view crew members"
  ON public.crew_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can insert themselves as members
CREATE POLICY "Users can join crews"
  ON public.crew_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own membership
CREATE POLICY "Users can leave crews"
  ON public.crew_members FOR DELETE
  USING (auth.uid() = user_id);

-- Crew owners can delete members (for kick functionality)
CREATE POLICY "Crew owners can remove members"
  ON public.crew_members FOR DELETE
  USING (
    crew_id IN (
      SELECT id FROM public.crews WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- FIX CREWS POLICIES (Simplify)
-- =====================================================

-- Drop the recursive policy on crews
DROP POLICY IF EXISTS "Crew members can view their crew" ON public.crews;
DROP POLICY IF EXISTS "Users can view their crews" ON public.crews;

-- Create simpler policy - users can view crews they own or are members of
-- Use a subquery that doesn't trigger recursion
CREATE POLICY "Users can view their crews"
  ON public.crews FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.crew_members 
      WHERE crew_members.crew_id = crews.id 
      AND crew_members.user_id = auth.uid()
    )
  );

-- =====================================================
-- ADD LOGO COLUMN TO CREWS TABLE
-- =====================================================

-- Add logo column for crew customization
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crews' AND column_name = 'logo'
  ) THEN
    ALTER TABLE public.crews 
    ADD COLUMN logo TEXT DEFAULT '🛡️';
  END IF;
END $$;

-- =====================================================
-- UPDATE get_user_crew FUNCTION TO INCLUDE LOGO
-- =====================================================

-- Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_user_crew();

-- Create new function with logo column
CREATE FUNCTION public.get_user_crew()
RETURNS TABLE (
  crew_id UUID,
  crew_name TEXT,
  crew_description TEXT,
  invite_code TEXT,
  logo TEXT,
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
    c.logo,
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
  GROUP BY c.id, c.name, c.description, c.invite_code, c.logo, c.max_members, 
           c.owner_id, p.username, cm.role, cm.joined_at
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DONE! Test by creating a crew
-- =====================================================
