# Crew Budget/Goals Feature

## Overview
The crew budget/goals feature allows crew owners to set shared financial targets for their crew members to work towards together. This promotes collaborative financial responsibility and teamwork.

## Features

### For Crew Owners:
- **Create Budget Goals**: Set spending targets for specific expense categories
- **Period Selection**: Choose between weekly or monthly budget periods
- **Repeating Option**: Set budgets to repeat each period or be one-time only
- **Category Assignment**: Assign budgets to default expense categories (ensures compatibility across all crew members)
- **Budget Management**: View, edit, and delete crew budget goals
- **Target Amount**: Set specific dollar amounts for each budget goal

### For Crew Members:
- **View Budgets**: See all budget goals set by the crew owner
- **Track Progress**: Monitor crew spending against set targets (future feature)
- **Collaborative Goals**: Work together to stay within budget limits

## Setup Instructions

### 1. Database Schema
Run the SQL migration in your Supabase project:

```bash
# Navigate to financetracker directory
cd financetracker

# Copy the SQL file contents from crew-budgets-schema.sql
# Then paste and run it in Supabase SQL Editor
```

Or manually run in Supabase SQL Editor:
- Go to your Supabase Dashboard
- Navigate to SQL Editor
- Open `crew-budgets-schema.sql`
- Execute the entire file

### 2. Verify Table Creation
After running the SQL, verify the table exists:

```sql
SELECT * FROM crew_budgets LIMIT 1;
```

### 3. Test the Feature
1. Open the app and navigate to "Your Crew"
2. As a crew owner, you should see a "Crew Budget Goals" section
3. Click the + button to create a new budget goal
4. Fill in:
   - Goal name (e.g., "Team Food Budget")
   - Target amount (e.g., 500.00)
   - Period (weekly or monthly)
   - Category (select from your expense categories)
5. Save and verify it appears in the list

## Database Schema

### Table: `crew_budgets`
```sql
- id: UUID (primary key)
- crew_id: UUID (foreign key to crews)
- name: TEXT (budget name)
- target: DECIMAL(15,2) (target amount)
- period: TEXT ('week' or 'month')
- category: TEXT (category ID - must match DEFAULT_CATEGORIES)
- is_repeating: BOOLEAN (whether budget repeats each period)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Row Level Security Policies:
1. **View**: All crew members can view their crew's budgets
2. **Create**: Only crew owners can create budgets
3. **Update**: Only crew owners can update budgets
4. **Delete**: Only crew owners can delete budgets

## API Functions

### `getCrewBudgets(crewId: string)`
Fetches all budget goals for a crew.

**Returns:**
```typescript
{
  success: boolean;
  budgets?: CrewBudget[];
  error?: string;
}
```

### `createCrewBudget(params)`
Creates a new budget goal (owner only).

**Parameters:**
```typescript
{
  crewId: string;
  name: string;
  target: number;
  period: 'week' | 'month';
  category: string;
  isRepeating?: boolean; // default: true
}
```

**Returns:**
```typescript
{
  success: boolean;
  budget?: CrewBudget;
  error?: string;
}
```

### `updateCrewBudget(params)`
Updates an existing budget goal (owner only).

**Parameters:**
```typescript
{
  budgetId: string;
  crewId: string;
  name?: string;
  target?: number;
  period?: 'week' | 'month';
  category?: string;
}
```

### `deleteCrewBudget(params)`
Deletes a budget goal (owner only).

**Parameters:**
```typescript
{
  budgetId: string;
  crewId: string;
}
```

## UI Components

### Your Crew Page (`app/crew/your-crew.tsx`)

#### Crew Budget Goals Section (Owner Only)
- Displays all budget goals for the crew
- Shows empty state if no budgets exist
- Each budget card shows:
  - Category icon and name
  - Budget name
  - Target amount
  - Period (weekly/monthly)
  - Delete button

#### Create Budget Modal
- Goal name input
- Target amount input (decimal keyboard)
- Period selector (weekly/monthly toggle)
- Repeating toggle (on/off switch with description)
- Category selector (modal with list of default categories)
- Create button with loading state

#### Category Selection Modal
- Shows only DEFAULT_CATEGORIES expense categories
- Large, tappable list items with icons
- Active selection highlighted
- Checkmark for selected category
- Prevents issues with user-created categories that other members may not have

## Styling

All styles are defined in `createStyles` function:
- `sectionTitleRow`: Header with title and add button
- `budgetCard`: Individual budget card styling
- `budgetHeader`: Budget card header with icon and info
- `budgetDetails`: Budget stats display
- `periodSelector`: Weekly/monthly toggle buttons
- `categoryScroll`: Horizontal category chip selector
- `emptyBudgets`: Empty state styling

## Future Enhancements

### Planned Features:
1. **Progress Tracking**: Show actual spending vs. budget target
2. **Real-time Updates**: Live progress updates as crew members add transactions
3. **Budget Notifications**: Alert crew when approaching budget limits
4. **Budget Analytics**: Charts and insights on budget performance
5. **Recurring Budgets**: Automatically reset budgets each period
6. **Budget Categories**: Group budgets by type
7. **Budget History**: Track budget performance over time
8. **Crew Challenges**: Gamify staying within budget limits

### Integration Points:
- Connect to transaction data for real-time spending calculation
- Add mission rewards for meeting budget goals
- Display budget progress on leaderboard
- Show budget alerts in notifications

## Troubleshooting

### Table doesn't exist error
**Problem**: Getting "relation 'crew_budgets' does not exist"
**Solution**: Run the SQL migration file in Supabase SQL Editor

### Permission denied error
**Problem**: "new row violates row-level security policy"
**Solution**: Ensure RLS policies are correctly set up and user is authenticated

### Budgets not loading
**Problem**: Empty budget list when budgets exist
**Solution**: Check:
1. User is a crew member
2. RLS policies allow SELECT
3. crew_id matches user's crew

### Can't create budgets
**Problem**: Only owners can create budgets
**Solution**: Verify user's role is 'owner' in crew_members table

## Code Examples

### Creating a Budget
```typescript
const result = await createCrewBudget({
  crewId: 'crew-uuid',
  name: 'Team Food Budget',
  target: 500.00,
  period: 'month',
  category: 'cat-food-expense',
  isRepeating: true // Budget will reset each month
});

if (result.success) {
  console.log('Budget created:', result.budget);
}
```

### Fetching Budgets
```typescript
const result = await getCrewBudgets('crew-uuid');

if (result.success && result.budgets) {
  result.budgets.forEach(budget => {
    console.log(`${budget.name}: $${budget.target} per ${budget.period}`);
  });
}
```

### Deleting a Budget
```typescript
const result = await deleteCrewBudget({
  budgetId: 'budget-uuid',
  crewId: 'crew-uuid'
});

if (result.success) {
  console.log('Budget deleted');
}
```

## File Locations

- **Schema**: `financetracker/crew-budgets-schema.sql`
- **Service**: `financetracker/lib/crew-service.ts`
- **UI**: `financetracker/app/crew/your-crew.tsx`
- **Types**: Defined in crew-service.ts (`CrewBudget` type)

## Testing Checklist

- [ ] Run SQL migration successfully
- [ ] Verify table exists in database
- [ ] Create a crew as owner
- [ ] Navigate to Your Crew page
- [ ] See "Crew Budget Goals" section
- [ ] Click + button to add budget
- [ ] Fill in all budget details
- [ ] Successfully create budget
- [ ] Budget appears in list
- [ ] Delete budget works
- [ ] Non-owners cannot see add button
- [ ] Crew members can view budgets
- [ ] Error handling works correctly
