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
-- DONE! Test by creating a crew
-- =====================================================
