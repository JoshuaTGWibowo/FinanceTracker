-- Crew Budget Contributions Table
-- Stores aggregated spending data from each crew member for collaborative budget tracking
-- This allows multiple users to contribute to the same budget while keeping transaction details local

CREATE TABLE IF NOT EXISTS public.crew_budget_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
    budget_id UUID NOT NULL REFERENCES public.crew_budgets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    total_spent DECIMAL(15, 2) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one contribution record per user per budget per period
    UNIQUE(budget_id, user_id, period_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_crew_budget_contributions_budget ON public.crew_budget_contributions(budget_id);
CREATE INDEX IF NOT EXISTS idx_crew_budget_contributions_crew ON public.crew_budget_contributions(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_budget_contributions_user ON public.crew_budget_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_budget_contributions_period ON public.crew_budget_contributions(period_start, period_end);

-- Auto-update updated_at timestamp
CREATE OR REPLACE TRIGGER update_crew_budget_contributions_updated_at
    BEFORE UPDATE ON public.crew_budget_contributions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.crew_budget_contributions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Crew members can view budget contributions" ON public.crew_budget_contributions;
DROP POLICY IF EXISTS "Users can manage their own contributions" ON public.crew_budget_contributions;
DROP POLICY IF EXISTS "Crew owners can delete contributions" ON public.crew_budget_contributions;

-- Policy: Crew members can view all contributions for their crew's budgets
CREATE POLICY "Crew members can view budget contributions"
    ON public.crew_budget_contributions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.crew_members
            WHERE crew_members.crew_id = crew_budget_contributions.crew_id
            AND crew_members.user_id = auth.uid()
        )
    );

-- Policy: Users can insert/update their own contributions
CREATE POLICY "Users can manage their own contributions"
    ON public.crew_budget_contributions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Crew owners can delete any contributions in their crew
CREATE POLICY "Crew owners can delete contributions"
    ON public.crew_budget_contributions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.crews
            WHERE crews.id = crew_budget_contributions.crew_id
            AND crews.owner_id = auth.uid()
        )
    );

COMMENT ON TABLE public.crew_budget_contributions IS 'Aggregated spending data for crew budget tracking without exposing individual transaction details';
COMMENT ON COLUMN public.crew_budget_contributions.total_spent IS 'Sum of transaction amounts for this user in this budget period';
COMMENT ON COLUMN public.crew_budget_contributions.transaction_count IS 'Number of transactions contributing to this total';
COMMENT ON COLUMN public.crew_budget_contributions.last_synced_at IS 'Last time this contribution was synced from local data';
