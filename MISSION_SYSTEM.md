# Mission System Implementation

## Overview
The mission system provides daily, weekly, and monthly challenges that users can complete to earn points and level up. Missions automatically track progress based on user activity and award points upon completion.

## Database Schema

### Tables
- **missions**: Stores all available missions
  - `id`, `title`, `description`
  - `mission_type`: 'individual' or 'crew'
  - `goal_type`: 'transactions_logged', 'streak', 'budget_adherence', 'savings_rate'
  - `goal_target`: Numeric value to reach (e.g., 3 transactions, 7-day streak, 20% savings rate)
  - `points_reward`: Points awarded on completion
  - `start_date`, `end_date`: Mission timeframe
  - `is_active`: Whether mission is currently available

- **user_missions**: Tracks user progress on missions
  - `user_id`, `mission_id`
  - `progress`: Percentage progress (0-100)
  - `completed`: Boolean completion status
  - `completed_at`: Timestamp of completion

- **crew_missions**: Links crew missions to specific crews
  - `crew_id`, `mission_id`
  - `progress`: Crew's collective progress
  - `completed`: Completion status

## Implementation Files

### 1. Mission Service (`lib/mission-service.ts`)
Core mission management system with the following functions:

#### Data Fetching
- **`getActiveMissions(missionType?)`**: Fetch all active missions from Supabase, optionally filtered by type ('individual' or 'crew')
- **`getUserMissions()`**: Get current user's mission progress from user_missions table

#### Progress Calculation
- **`calculateMissionProgress(mission, transactions, streak)`**: Calculate progress percentage based on goal type
  - **transactions_logged**: Count total transactions / goal_target × 100
  - **streak**: Current streak days / goal_target × 100
  - **savings_rate**: (Income - Expenses) / Income × 100 compared to goal_target
  - **budget_adherence**: Percentage of budgets user is staying within

#### Progress Updates
- **`updateMissionProgress({missionId, progress})`**: Upsert progress to user_missions table
- **`checkAndUpdateAllMissions(transactions, streak)`**: Check all active missions and update progress
  - Returns list of newly completed missions
  - Automatically calls `completeMission` for missions reaching 100%

#### Mission Completion
- **`completeMission(mission)`**: Award points and mark mission as completed
  - Calls `awardPoints(userId, pointsReward, 'all_time')`
  - Updates user_missions with completed=true and completed_at timestamp
  - Returns success status

#### UI Helper
- **`getMissionsWithProgress(transactions, streak, filter)`**: Fetch missions with progress for display
  - Combines missions with user progress
  - Supports filtering: 'all', 'active', 'completed'
  - Returns array of Mission & { progress: number; completed: boolean }

### 2. Transaction Integration (`lib/store.ts`)
Automatic mission checking when transactions are added:

```typescript
// In addTransaction function:
getLeaderboardStats().then(statsResult => {
  if (statsResult.success && statsResult.stats) {
    checkAndUpdateAllMissions(
      state.transactions,
      statsResult.stats.streakDays
    ).then(result => {
      if (result.success && result.completedMissions && result.completedMissions.length > 0) {
        console.log(`[Mission] 🎉 Completed ${result.completedMissions.length} mission(s)!`);
      }
    }).catch(err => console.error('[Mission] Error checking missions:', err));
  }
}).catch(err => console.error('[Mission] Error getting stats:', err));
```

### 3. UI Display (`app/(tabs)/leaderboard.tsx`)
Mission display on Crew tab with filtering:

#### State Management
- **missions**: Array of Mission & { progress: number; completed: boolean }
- **missionFilter**: 'all' | 'active' | 'completed'
- **missionPeriod**: 'daily' | 'weekly' | 'monthly'

#### Functions
- **`loadMissions()`**: Fetch missions with progress using `getMissionsWithProgress()`
- **`getMissionIcon(goalType)`**: Map goal types to Ionicons
- **`renderMission(mission)`**: Render mission card with progress bar

#### Filtering Logic
```typescript
const filteredMissions = useMemo(() => {
  // Filter by mission type (individual)
  let filtered = missions.filter(m => m.missionType === 'individual');
  
  // Filter by period (daily/weekly/monthly)
  filtered = filtered.filter(m => {
    const desc = m.description.toLowerCase();
    if (missionPeriod === 'daily') return desc.includes('today') || desc.includes('day');
    if (missionPeriod === 'weekly') return desc.includes('week');
    if (missionPeriod === 'monthly') return desc.includes('month');
    return false;
  });
  
  // Filter by completion status
  if (missionFilter === 'completed') return filtered.filter(m => m.completed);
  if (missionFilter === 'active') return filtered.filter(m => !m.completed);
  return filtered;
}, [missions, missionFilter, missionPeriod]);
```

### 4. Database Seed (`financetracker/missions-seed.sql`)
Pre-populated missions for immediate use:

#### Daily Missions (24-hour goals)
- Log 3 transactions: +15 points
- Log 5 transactions: +25 points
- Stay within budget: +20 points
- Save 10% of income: +30 points
- Save 20% of income: +50 points

#### Weekly Missions (7-day goals)
- Maintain 7-day streak: +100 points
- Log 20 transactions: +75 points
- Log 35 transactions: +125 points
- Stay within budget all week: +150 points
- Save 15% weekly: +100 points
- Save 25% weekly: +175 points

#### Monthly Missions (30-day goals)
- Maintain 30-day streak: +500 points
- Maintain 60-day streak: +1000 points
- Log 100 transactions: +300 points
- Log 200 transactions: +600 points
- Stay within budget all month: +750 points
- Save 20% monthly: +400 points
- Save 30% monthly: +750 points
- Save 40% monthly: +1200 points

#### Crew Missions (weekly examples)
- Crew logs 100 transactions: +200 points
- Crew saves 20% collectively: +250 points
- All crew members stay within budget: +300 points

## Setup Instructions

### 1. Run Database Migrations
Execute the missions seed file in your Supabase SQL editor:
```sql
-- Run financetracker/missions-seed.sql
```

This will populate the missions table with initial challenges. The seed uses `ON CONFLICT DO NOTHING` so it's safe to re-run.

### 2. Verify Integration
The mission system is already integrated with:
- ✅ Transaction logging (auto-checks missions on each transaction)
- ✅ Points service (awards points on mission completion)
- ✅ Leaderboard UI (displays missions with progress)

### 3. Test Mission Flow
1. **Log transactions** to trigger mission checking
2. **Check console** for mission completion messages: `[Mission] 🎉 Completed X mission(s)!`
3. **View missions** on Crew tab to see progress bars
4. **Filter missions** by period (daily/weekly/monthly) and status (active/completed)

## Mission Progress Calculation Details

### Transactions Logged
Counts total transactions in the period:
```typescript
const transactionCount = transactions.filter(/* within period */).length;
const progress = Math.min((transactionCount / goalTarget) * 100, 100);
```

### Streak
Uses current streak from leaderboard_stats:
```typescript
const progress = Math.min((currentStreak / goalTarget) * 100, 100);
```

### Savings Rate
Calculates (Income - Expenses) / Income ratio:
```typescript
const income = transactions.filter(t => t.type === 'income').reduce(sum);
const expenses = transactions.filter(t => t.type === 'expense').reduce(sum);
const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
const progress = Math.min((savingsRate / goalTarget) * 100, 100);
```

### Budget Adherence
Percentage of budgets user is staying within:
```typescript
// Implementation pending - requires budget comparison logic
// For now, returns 0 or 100 based on budget status
```

## Future Enhancements

### Planned Features
1. **Mission Notifications**: Show toast/modal when missions complete
2. **Mission History**: View completed missions from past periods
3. **Custom Missions**: Allow users to create personal challenges
4. **Crew Challenges**: Collaborative missions requiring crew coordination
5. **Mission Streaks**: Bonus points for completing missions X days in a row
6. **Difficulty Tiers**: Easy/Medium/Hard missions with scaling rewards
7. **Seasonal Events**: Limited-time special missions with bonus rewards
8. **Mission Chains**: Complete Mission A to unlock Mission B
9. **Leaderboard Integration**: Rank users by missions completed
10. **Push Notifications**: Alert users about expiring missions

### Advanced Budget Adherence
Current implementation is simplified. Full implementation would:
- Compare actual spending to budget limits for each category
- Calculate percentage of budgets user is staying within
- Weight by budget importance or category spending
- Account for multiple budget periods (daily/weekly/monthly)

## Troubleshooting

### Missions Not Appearing
1. Verify missions-seed.sql was executed successfully
2. Check `start_date` and `end_date` are current
3. Ensure `is_active` is true for missions
4. Verify RLS policies allow reading from missions table

### Progress Not Updating
1. Check console for error messages: `[Mission] Error checking missions`
2. Verify transactions are being logged successfully
3. Ensure leaderboard_stats table has user record with streak
4. Check user_missions table has proper RLS policies

### Points Not Awarded
1. Verify mission reached 100% progress
2. Check `completeMission` function was called (console log)
3. Ensure points-service `awardPoints` is working
4. Verify leaderboard_stats updates are persisting

### Mission Completion Not Triggering
1. Check `checkAndUpdateAllMissions` is called after transactions
2. Verify progress calculation returns >= 100 for completed missions
3. Ensure user_missions table allows INSERT/UPDATE for authenticated users
4. Check Supabase RLS policies for user_missions table

## API Reference

### Mission Type
```typescript
type Mission = {
  id: string;
  title: string;
  description: string;
  missionType: 'individual' | 'crew';
  goalType: 'savings_rate' | 'streak' | 'budget_adherence' | 'transactions_logged';
  goalTarget: number;
  pointsReward: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
};
```

### User Mission Type
```typescript
type UserMission = {
  id: string;
  userId: string;
  missionId: string;
  progress: number; // 0-100
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  mission?: Mission;
};
```

### Service Functions
```typescript
// Fetch missions
getActiveMissions(missionType?: 'individual' | 'crew'): Promise<{
  success: boolean;
  missions?: Mission[];
  error?: string;
}>;

// Get user progress
getUserMissions(): Promise<{
  success: boolean;
  userMissions?: UserMission[];
  error?: string;
}>;

// Calculate progress
calculateMissionProgress(
  mission: Mission,
  transactions: Transaction[],
  currentStreak: number
): number; // 0-100

// Update progress
updateMissionProgress({
  missionId: string,
  progress: number
}): Promise<{
  success: boolean;
  userMission?: UserMission;
  error?: string;
}>;

// Complete mission
completeMission(mission: Mission): Promise<{
  success: boolean;
  error?: string;
}>;

// Check all missions
checkAndUpdateAllMissions(
  transactions: Transaction[],
  currentStreak: number
): Promise<{
  success: boolean;
  completedMissions?: Mission[];
  error?: string;
}>;

// Get missions with progress
getMissionsWithProgress(
  transactions: Transaction[],
  currentStreak: number,
  filter?: 'all' | 'active' | 'completed'
): Promise<{
  success: boolean;
  missions?: Array<Mission & { progress: number; completed: boolean }>;
  error?: string;
}>;
```

## Related Documentation
- [Points and Leveling System](./POINTS_AND_LEVELING_SYSTEM.md)
- [Crew Features](./CREW_FEATURES_ADDED.md)
- [Supabase Integration](./SUPABASE_INTEGRATION.md)
