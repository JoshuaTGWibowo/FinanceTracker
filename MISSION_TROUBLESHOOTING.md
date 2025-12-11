# Mission System Troubleshooting Guide

## Issue 1: Mission Completed But No Points Awarded

### Symptoms
- Mission progress reaches 100%
- Mission shows as completed in UI
- Points are not added to user's total
- No level up occurs

### Possible Causes & Solutions

#### 1. **Check Console Logs**
Look for these log messages in your browser/Expo console:
```
[Mission] 🎊 New completion detected for "Mission Name" - awarding points...
[Mission] Successfully awarded X points!
[Mission] ✅ Completed "Mission Name" - Awarded X pts
```

If you see errors instead:
```
[Mission] Failed to award points: [error message]
[Mission] Failed to complete mission: [error message]
```

#### 2. **Verify RLS Policies**
The `leaderboard_stats` table needs proper RLS policies for updates:

```sql
-- Check if this policy exists
CREATE POLICY "Users can update own stats"
  ON public.leaderboard_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- Also check INSERT policy
CREATE POLICY "Users can insert own stats"
  ON public.leaderboard_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 3. **Check user_missions Table**
Verify the mission completion is being recorded:

```sql
SELECT * FROM user_missions 
WHERE user_id = 'your-user-id' 
AND completed = true;
```

#### 4. **Verify leaderboard_stats Record Exists**
The user must have a record in `leaderboard_stats` for 'all_time' period:

```sql
SELECT * FROM leaderboard_stats 
WHERE user_id = 'your-user-id' 
AND period = 'all_time';
```

If no record exists, initialize it:
```sql
SELECT initialize_user_stats('your-user-id');
```

## Issue 2: Mission Progress Updates Slowly

### Symptoms
- Transaction logged
- Mission progress doesn't update immediately
- Takes 5-10 seconds to see progress change

### Causes
- Mission checking is asynchronous
- Needs to fetch leaderboard stats first
- UI doesn't auto-refresh after mission updates

### Solutions

#### 1. **Improved Implementation** (Already Applied)
The code now triggers a state update after mission completion:
```typescript
if (result.success && result.completedMissions && result.completedMissions.length > 0) {
  console.log(`[Mission] 🎉 Completed ${result.completedMissions.length} mission(s)!`);
  // Trigger a state update to refresh mission data in UI
  set({ transactions: state.transactions });
}
```

#### 2. **Manual Refresh**
Pull down on the leaderboard screen to manually refresh missions.

#### 3. **Wait for Async Operations**
The mission check happens after:
1. Transaction is added to database ✓
2. Points are awarded for transaction ✓
3. Daily streak is updated ✓
4. Budgets are checked ✓
5. Leaderboard stats are fetched ✓
6. Mission progress is calculated and updated ✓

This typically takes 2-3 seconds total.

## Issue 3: Daily Mission Timer Shows Wrong Time

### Symptoms
- Daily mission says "19m left" but it's only 4pm local time
- Missions expire at unexpected times
- Time zones seem off

### Cause
PostgreSQL `CURRENT_DATE` uses UTC timezone, not your local timezone.

### Solutions

#### 1. **Use missions-seed-v2.sql** (Recommended)
The updated seed file uses `NOW()` instead of `CURRENT_DATE` for daily missions:

```sql
-- Old (uses calendar days in UTC)
('Daily Logger', '...', ..., CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', true)

-- New (uses 24-hour periods from current time)
('Daily Logger', '...', ..., NOW(), NOW() + INTERVAL '24 hours', true)
```

To apply:
1. Delete existing missions: `DELETE FROM missions;`
2. Run `missions-seed-v2.sql` in Supabase SQL editor

#### 2. **Set Supabase Database Timezone**
Configure your database to use your local timezone:

```sql
-- Example for Asia/Jakarta (GMT+7)
ALTER DATABASE postgres SET timezone TO 'Asia/Jakarta';

-- Or for US Eastern Time
ALTER DATABASE postgres SET timezone TO 'America/New_York';

-- Check current timezone
SHOW timezone;
```

Or set it in Supabase Dashboard:
- Settings → Database → Timezone

#### 3. **Use 24-Hour Missions Instead of Calendar Days**
Daily missions in `missions-seed-v2.sql` now use 24-hour periods:
- Start: `NOW()` (when mission is created)
- End: `NOW() + INTERVAL '24 hours'` (24 hours from creation)

This means if you create the mission at 4:00 PM, it expires at 4:00 PM the next day (not at midnight).

## Issue 4: Mission Doesn't Show as Completed in UI

### Symptoms
- Console says mission completed
- Points awarded successfully  
- But mission still shows as "active" with progress bar

### Cause
UI state not refreshing after mission completion.

### Solutions

#### 1. **Pull to Refresh**
Swipe down on the leaderboard screen to refresh.

#### 2. **Check State Update**
Verify this code is in `store.ts`:
```typescript
set({ transactions: state.transactions });
```

#### 3. **Force Re-fetch**
Navigate away from Crew tab and back.

#### 4. **Clear and Re-query**
The `loadMissions()` function should fetch fresh data:
```typescript
const loadMissions = async () => {
  if (!isAuth) return;
  
  setIsLoadingMissions(true);
  const result = await getMissionsWithProgress(
    transactions,
    userStats?.streakDays || 0,
    'all' // Get all missions
  );
  
  if (result.success && result.missions) {
    setMissions(result.missions);
  }
  setIsLoadingMissions(false);
};
```

## Debugging Checklist

When a mission doesn't work properly:

1. **Check Console Logs**
   - [ ] Mission progress calculation logged
   - [ ] "🎊 New completion detected" message
   - [ ] Points awarded message
   - [ ] No error messages

2. **Verify Database**
   - [ ] `user_missions` record exists for mission
   - [ ] `completed` field is `true`
   - [ ] `completed_at` timestamp is set
   - [ ] `leaderboard_stats` total_points increased

3. **Check RLS Policies**
   - [ ] Can read from `missions` table
   - [ ] Can INSERT/UPDATE `user_missions`
   - [ ] Can UPDATE `leaderboard_stats`

4. **Test Mission Progress Calculation**
   Run this in browser console:
   ```javascript
   import { calculateMissionProgress } from './lib/mission-service';
   
   // Get current transaction count
   console.log('Transactions:', transactions.length);
   
   // Manually calculate progress
   const mission = { goalType: 'transactions_logged', goalTarget: 3 };
   const progress = calculateMissionProgress(mission, transactions, 0);
   console.log('Progress:', progress);
   ```

5. **Verify Timing**
   - [ ] Mission `starts_at` is in the past
   - [ ] Mission `ends_at` is in the future
   - [ ] Mission `is_active` is `true`

## Quick Fixes

### Reset All Missions
```sql
-- Clear all user progress
DELETE FROM user_missions;

-- Delete all missions
DELETE FROM missions;

-- Re-seed with v2
-- (Run missions-seed-v2.sql)
```

### Reset Single User's Missions
```sql
DELETE FROM user_missions 
WHERE user_id = 'your-user-id';
```

### Manually Award Points
```sql
UPDATE leaderboard_stats 
SET total_points = total_points + 50,
    level = FLOOR(LOG(2, (total_points + 50) / 100) + 1)
WHERE user_id = 'your-user-id' 
AND period = 'all_time';
```

### Check Mission Progress in Real-Time
```sql
SELECT 
  m.title,
  m.goal_type,
  m.goal_target,
  m.points_reward,
  um.progress,
  um.completed,
  um.completed_at,
  m.ends_at
FROM missions m
LEFT JOIN user_missions um ON m.id = um.mission_id AND um.user_id = 'your-user-id'
WHERE m.is_active = true
ORDER BY m.ends_at;
```

## Prevention Tips

1. **Always check console logs** when testing missions
2. **Use missions-seed-v2.sql** for timezone-aware missions
3. **Set database timezone** to match your location
4. **Test with simple missions** first (e.g., "Log 1 transaction")
5. **Verify RLS policies** before going live
6. **Initialize user stats** when creating new users
7. **Monitor Supabase logs** for database errors
