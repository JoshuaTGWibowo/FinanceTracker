-- Migration: Add status column to crew_members table
-- This allows tracking of active/inactive/pending crew members

DO $$ 
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'crew_members' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.crew_members 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'pending'));
        
        RAISE NOTICE 'Added status column to crew_members table';
    ELSE
        RAISE NOTICE 'Status column already exists in crew_members table';
    END IF;
END $$;

-- Update any existing records to have 'active' status
UPDATE public.crew_members 
SET status = 'active' 
WHERE status IS NULL;

COMMENT ON COLUMN public.crew_members.status IS 'Member status: active, inactive, or pending invitation';
