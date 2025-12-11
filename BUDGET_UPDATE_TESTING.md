# Budget Update Testing Guide

## What Changed

### 1. Parent-Child Category Support
Budgets now track transactions from **both parent categories and their children**.

**Example:**
- Budget: "Food" category ($500/month)
- Transactions that count:
  - ✅ Direct "Food" transactions
  - ✅ "Groceries" transactions (child of Food)
  - ✅ "Dining" transactions (child of Food)

### 2. Debug Logging
Added console logs to track budget sync and calculations:
- `[Budget Sync]` - When syncing contributions to Supabase
- `[Budget Calc]` - When calculating spending
- `[Load Crew]` - When loading crew data

### 3. Refresh Button
Added manual refresh button to force reload budget data.

## Testing Steps

### Test 1: Direct Category Match
1. Create a budget with category "Food" ($500/month)
2. Add a transaction: $50 expense, category "Food"
3. **Expected**: Budget shows $50/$500 (10%)

### Test 2: Child Category Match
1. Keep the "Food" budget from Test 1
2. Add a transaction: $30 expense, category "Groceries" (child of Food)
3. **Expected**: Budget shows $80/$500 (16%)
   - $50 from direct Food + $30 from Groceries child

### Test 3: Multiple Children
1. Keep the "Food" budget
2. Add a transaction: $25 expense, category "Dining" (child of Food)
3. **Expected**: Budget shows $105/$500 (21%)
   - $50 Food + $30 Groceries + $25 Dining

### Test 4: Unrelated Category
1. Keep the "Food" budget
2. Add a transaction: $100 expense, category "Travel"
3. **Expected**: Budget still shows $105/$500 (21%)
   - Travel is not related to Food

### Test 5: Multi-User Sync
1. User A creates "Groceries" budget ($300/month)
2. User A adds transaction: $50 Groceries
3. User B (crew member) adds transaction: $75 Groceries
4. **Expected**: Budget shows $125/$300 from both users

## Debugging

### Check Console Logs
Open browser/app console and filter by:
- `[Budget Sync]` - See sync operations
- `[Budget Calc]` - See calculation details
- `[Load Crew]` - See initial load

### Expected Log Output
```
[Budget Sync] Starting sync for 1 budgets with 5 transactions
[Budget Sync] Synced budget Food: success
[Budget Calc] Food: { spending: 105, target: 500, progress: 21 }
```

### If Budget Not Updating

1. **Check Categories**
   - Verify child categories have correct `parentCategoryId`
   - Open console: `console.log(categories)` in React DevTools

2. **Check Transactions**
   - Verify transactions are expenses (not income)
   - Check transaction dates are within budget period
   - Verify category IDs match exactly

3. **Force Refresh**
   - Tap the refresh button (↻) next to budget title
   - This reloads all budget data

4. **Check Database**
   - Run in Supabase SQL Editor:
     ```sql
     SELECT * FROM crew_budget_contributions 
     WHERE budget_id = 'your-budget-id';
     ```
   - Should show contributions from all crew members

## Category Hierarchy Reference

### Food (Parent)
- Groceries (Child)
- Dining (Child)

### Lifestyle (Parent)
- Fitness (Child)
- Entertainment (Child)

### Travel (Parent)
- Transport (Child)

### Home (Parent)
- Bills (Child)
- Utilities (Child)
- Rent (Child)

## Troubleshooting

### Problem: Budget shows $0 despite transactions
**Possible Causes:**
- Transactions are in different category
- Transactions are before budget start date
- Categories don't have parent-child relationship set up
- Supabase contributions table not created

**Solution:**
1. Check console logs for errors
2. Verify transaction category matches budget category
3. Run migrations: `crew-members-status-migration.sql` and `crew-budget-contributions-schema.sql`

### Problem: Child categories not counting
**Possible Causes:**
- `parentCategoryId` not set correctly
- Using custom categories instead of DEFAULT_CATEGORIES

**Solution:**
1. Budget must use DEFAULT_CATEGORIES (parent categories only)
2. Check category object: `console.log(categories.find(c => c.id === 'cat-groceries-expense'))`
3. Should have: `parentCategoryId: 'cat-food-expense'`

### Problem: Other crew members not showing
**Possible Causes:**
- Supabase contributions table doesn't exist
- RLS policies blocking access
- Members haven't synced yet

**Solution:**
1. Run both SQL migrations in order
2. Ask crew members to add a transaction (triggers sync)
3. Check Supabase logs for RLS policy errors

## Files Modified

- `lib/categoryUtils.ts` - Added parent-child category helpers
- `lib/crew-service.ts` - Updated budget calculations to include children
- `app/crew/your-crew.tsx` - Added debug logging and refresh button
