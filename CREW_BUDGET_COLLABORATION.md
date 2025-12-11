# Crew Budget Collaboration

## Overview

This system enables multiple crew members to contribute to shared budgets while keeping individual transaction data private and stored locally. It uses an **aggregated contribution model** where only spending summaries are synced to Supabase, never individual transaction details.

## Architecture

### Local Storage (SQLite)
- Full transaction details stored in each user's device
- Fast, offline-capable transaction management
- Complete privacy - only you see your transaction details

### Cloud Sync (Supabase)
- Aggregated spending summaries per budget per member
- No individual transaction amounts or descriptions
- Enables crew-wide budget progress tracking

## How It Works

### 1. Budget Creation
- Crew owner creates a budget (e.g., "Groceries - $500/month")
- Budget stored in `crew_budgets` table
- All crew members can see the budget

### 2. Local Transaction Recording
- Each member adds transactions locally (SQLite)
- Transactions match budget category (e.g., "Groceries")
- Full details stay on device

### 3. Contribution Sync
- App calculates your spending for each budget period
- Only totals are synced to `crew_budget_contributions` table
- Synced data: `total_spent` and `transaction_count` (no details)

### 4. Crew-Wide Progress
- App sums all members' contributions
- Displays total crew spending vs. budget target
- Shows who's contributing without revealing individual amounts

## Database Schema

### crew_budgets
Stores budget definitions created by crew owners.

```sql
CREATE TABLE crew_budgets (
  id UUID PRIMARY KEY,
  crew_id UUID REFERENCES crews(id),
  name TEXT,
  target DECIMAL(15,2),
  period TEXT, -- 'week' or 'month'
  category TEXT,
  is_repeating BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### crew_budget_contributions
Stores aggregated spending summaries (no transaction details).

```sql
CREATE TABLE crew_budget_contributions (
  id UUID PRIMARY KEY,
  crew_id UUID REFERENCES crews(id),
  budget_id UUID REFERENCES crew_budgets(id),
  user_id UUID REFERENCES auth.users(id),
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  total_spent DECIMAL(15,2), -- Aggregated total
  transaction_count INTEGER, -- Number of transactions (no details)
  last_synced_at TIMESTAMP,
  UNIQUE(budget_id, user_id, period_start)
);
```

## Setup Instructions

### 1. Run Database Migration
Execute the schema in Supabase SQL Editor:

```bash
# Copy the schema file content
cat financetracker/crew-budget-contributions-schema.sql

# Paste and run in Supabase SQL Editor
```

### 2. Verify RLS Policies
The schema includes Row Level Security policies:
- **View**: All crew members can see contributions
- **Create/Update**: Users can only manage their own contributions
- **Delete**: Crew owners can delete any contributions

### 3. Test the Flow
1. Create a crew budget as owner
2. Add transactions in the budget's category
3. Watch progress sync automatically
4. Invite crew members and see their contributions

## API Functions

### syncBudgetContribution()
Syncs local transaction summary to Supabase.

```typescript
await syncBudgetContribution({
  crewId: 'crew-uuid',
  budget: budgetObject,
  transactions: localTransactionsArray
});
```

**What it does:**
- Filters transactions by budget category and period
- Calculates total spending
- Upserts to `crew_budget_contributions` table

**What it DOESN'T send:**
- Individual transaction amounts
- Transaction descriptions/notes
- Payee names
- Any personal financial details

### calculateCrewBudgetSpendingFromContributions()
Gets total crew spending from all members.

```typescript
const totalSpent = await calculateCrewBudgetSpendingFromContributions(budgetId);
```

Returns sum of all crew members' contributions for the budget.

## Privacy Model

### What Gets Synced
✅ Total spending per budget per period  
✅ Number of transactions (count only)  
✅ Last sync timestamp  

### What Stays Local
🔒 Individual transaction amounts  
🔒 Transaction descriptions  
🔒 Payee/merchant names  
🔒 Transaction timestamps  
🔒 Payment methods  
🔒 All other transaction metadata  

## Use Cases

### Family Groceries
- Mom sets $800/month grocery budget
- Dad, Mom, and kids all buy groceries
- Everyone sees total spending: $623/$800
- Nobody sees each other's individual purchases

### Roommate Utilities
- Create "Utilities - $300/month" budget
- All roommates pay various bills
- Track total contributions vs. target
- Individual bills stay private

### Team Office Supplies
- Budget: $200/month for supplies
- Team members buy as needed
- Track department spending
- Individual purchases remain confidential

## Benefits

1. **Privacy**: Individual transactions never leave your device
2. **Collaboration**: Multiple people contribute to shared goals
3. **Accountability**: See crew progress without surveillance
4. **Offline-First**: Record transactions without internet
5. **Sync When Ready**: Contributions sync automatically when online

## Troubleshooting

### Contributions Not Syncing
- Check internet connection
- Verify you're logged into Supabase
- Check browser console for errors
- Ensure `crew_budget_contributions` table exists

### Wrong Total Showing
- Verify transactions match budget category exactly
- Check transaction dates are in current period
- Ensure transactions are marked as "expense" type
- Try force-syncing by adding a new transaction

### Other Members Not Appearing
- Confirm they've added transactions in the budget category
- Check they're active crew members
- Verify their app has synced recently
- Ask them to add a transaction to trigger sync

## Future Enhancements

- Manual sync button for instant updates
- Contribution breakdown by member (aggregated)
- Historical period comparisons
- Budget achievement badges
- Spending trend visualizations

## Technical Notes

- Sync happens automatically on transaction changes
- Uses `upsert` for idempotent syncing
- Unique constraint prevents duplicate contributions
- Period dates calculated consistently across devices
- Falls back gracefully if Supabase unavailable
