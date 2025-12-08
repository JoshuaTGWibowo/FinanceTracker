-- Crew Budgets Schema
-- This file creates the crew_budgets table for shared financial goals

-- Create crew_budgets table
CREATE TABLE IF NOT EXISTS crew_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target DECIMAL(15, 2) NOT NULL CHECK (target > 0),
  period TEXT NOT NULL CHECK (period IN ('week', 'month')),
  category TEXT NOT NULL,
  is_repeating BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster crew budget lookups
CREATE INDEX IF NOT EXISTS idx_crew_budgets_crew_id ON crew_budgets(crew_id);

-- Enable RLS
ALTER TABLE crew_budgets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Crew members can view crew budgets" ON crew_budgets;
DROP POLICY IF EXISTS "Crew owners can insert budgets" ON crew_budgets;
DROP POLICY IF EXISTS "Crew owners can update budgets" ON crew_budgets;
DROP POLICY IF EXISTS "Crew owners can delete budgets" ON crew_budgets;

-- RLS Policies for crew_budgets

-- 1. Crew members can view their crew's budgets
CREATE POLICY "Crew members can view crew budgets"
  ON crew_budgets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crew_members cm
      WHERE cm.crew_id = crew_budgets.crew_id
      AND cm.user_id = auth.uid()
    )
  );

-- 2. Only crew owners can create budgets
CREATE POLICY "Crew owners can insert budgets"
  ON crew_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crews c
      WHERE c.id = crew_budgets.crew_id
      AND c.owner_id = auth.uid()
    )
  );

-- 3. Only crew owners can update budgets
CREATE POLICY "Crew owners can update budgets"
  ON crew_budgets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crews c
      WHERE c.id = crew_budgets.crew_id
      AND c.owner_id = auth.uid()
    )
  );

-- 4. Only crew owners can delete budgets
CREATE POLICY "Crew owners can delete budgets"
  ON crew_budgets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crews c
      WHERE c.id = crew_budgets.crew_id
      AND c.owner_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crew_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_crew_budgets_updated_at_trigger ON crew_budgets;

-- Create trigger for updated_at
CREATE TRIGGER update_crew_budgets_updated_at_trigger
  BEFORE UPDATE ON crew_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_crew_budgets_updated_at();
