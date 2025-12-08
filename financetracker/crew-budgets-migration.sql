-- Migration to add is_repeating column to crew_budgets table
-- Run this in Supabase SQL Editor

-- Add is_repeating column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crew_budgets' 
    AND column_name = 'is_repeating'
  ) THEN
    ALTER TABLE crew_budgets 
    ADD COLUMN is_repeating BOOLEAN NOT NULL DEFAULT true;
    
    RAISE NOTICE 'Column is_repeating added successfully';
  ELSE
    RAISE NOTICE 'Column is_repeating already exists';
  END IF;
END $$;
