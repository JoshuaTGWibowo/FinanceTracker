# Timezone & Mission Refresh Implementation

## Features Added

### 1. **Timezone Selection in Account Settings**

Users can now select their timezone from the Account tab, which affects:
- Mission start and end times
- Mission expiry and refresh cycles
- Daily/weekly/monthly boundaries

**Default Timezone**: Australia/Melbourne

**Available Timezones**:
- Australia: Sydney, Melbourne, Brisbane, Perth
- Pacific: Auckland (New Zealand)
- Asia: Jakarta, Singapore, Tokyo, Hong Kong
- Europe: London, Paris
- Americas: New York, Los Angeles, Chicago
- UTC

**How to Change**:
1. Go to Account tab
2. Scroll to "Timezone" section
3. Tap on desired timezone chip
4. Changes save automatically

### 2. **Automatic Mission Refresh System**

Missions now automatically refresh when they expire:

**Refresh Logic**:
- **On App Launch**: Checks for expired missions
- **Daily Missions**: Auto-create new 24-hour missions when previous ones expire
- **Weekly Missions**: Auto-create new weekly missions starting Sunday
- **Monthly Missions**: Auto-create new monthly missions on the 1st

**What Happens**:
1. System detects expired missions (ends_at < current time)
2. Marks old missions as inactive (is_active = false)
3. Creates new missions with same rewards/goals
4. New missions have fresh timeframes based on user's timezone
5. User progress resets (fresh start for new period)

**Console Logging**:
```
[Mission Refresh] Checking for expired missions...
[Mission Refresh] Found X expired mission(s)
[Mission Refresh] ✅ Refreshed X mission(s)
```

### 3. **Mission Initialization**

First-time users or empty mission tables automatically get populated:

**Initial Mission Set**:
- 4 daily missions (15-30 points)
- 4 weekly missions (75-150 points)  
- 4 monthly missions (300-750 points)

All missions are created with proper timestamps based on user's timezone.

## Technical Implementation

### Files Modified

**`lib/types.ts`**
- Added `timezone: string` field to `Profile` interface

**`lib/store.ts`**
- Added `setTimezone` action
- Default timezone set to "Australia/Melbourne"
- Timezone persists with profile data

**`app/(tabs)/account.tsx`**
- Added timezone picker UI with horizontal scroll
- 15 timezone options displayed as chips
- Active timezone highlighted

**`app/_layout.tsx`**
- Integrated mission refresh on app launch
- Calls `initializeMissions()` if no missions exist
- Calls `refreshExpiredMissions()` to handle expired missions
- Uses user's timezone from profile

### New Files

**`lib/mission-refresh.ts`**
Core mission refresh service with functions:

#### `refreshExpiredMissions(userTimezone)`
Checks for and refreshes expired missions:
- Fetches all active missions
- Identifies expired ones (ends_at < now)
- Deactivates expired missions
- Creates new missions with fresh timeframes
- Returns count of refreshed missions

#### `initializeMissions(userTimezone)`
Initializes missions for new users:
- Checks if any active missions exist
- If none, creates initial set (12 missions)
- Uses user's timezone for scheduling
- Called once on first app launch

#### `calculateNewTimeframe(timeframe, timezone)`
Calculates start/end times for missions:
- **Daily**: NOW() to NOW() + 24 hours
- **Weekly**: Start of week (Sunday) to end of week
- **Monthly**: Start of month to start of next month

#### `getTimeframeFromDescription(description)`
Extracts timeframe from mission description:
- Looks for keywords: "today", "day", "week", "month"
- Returns 'daily', 'weekly', or 'monthly'

## Usage

### Setting Timezone

```typescript
import { useFinanceStore } from './lib/store';

// In component
const setTimezone = useFinanceStore(state => state.setTimezone);
const currentTimezone = useFinanceStore(state => state.profile.timezone);

// Change timezone
await setTimezone('Asia/Singapore');
```

### Manual Mission Refresh

```typescript
import { refreshExpiredMissions } from './lib/mission-refresh';

// Refresh missions manually
const result = await refreshExpiredMissions('Australia/Melbourne');

if (result.success) {
  console.log(`Refreshed ${result.refreshedCount} missions`);
}
```

### Initialize Missions

```typescript
import { initializeMissions } from './lib/mission-refresh';

// Create initial mission set
const result = await initializeMissions('Australia/Melbourne');

if (result.success) {
  console.log('Missions initialized');
}
```

## Migration Notes

### Existing Users

Users who already have missions will need to:
1. **Set Their Timezone**: Go to Account tab and select timezone
2. **Missions Will Auto-Refresh**: Next time missions expire, they'll refresh automatically

### New Users

New users automatically get:
- Default timezone: Australia/Melbourne
- Initial 12 missions created on first app launch
- Missions scheduled according to their timezone

### Database Impact

**No Schema Changes Required** - Uses existing `missions` table structure.

**What Happens to Old Missions**:
- Expired missions marked as `is_active = false`
- User progress in `user_missions` retained for history
- New missions created with new IDs
- Old missions can be archived or deleted later

## Benefits

1. **User-Friendly**: Missions align with user's local time
2. **Automatic**: No manual intervention needed
3. **Consistent**: Same missions rotate on predictable schedule
4. **Timezone-Aware**: Respects user's location
5. **No Gaps**: Missions always available (auto-refresh on expiry)

## Testing

### Test Mission Expiry

1. Create a test mission with `ends_at` in the past:
```sql
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES ('Test Mission', 'Test expired mission', 'individual', 'transactions_logged', 1, 10, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', true);
```

2. Close and reopen app
3. Check console for: `[Mission Refresh] ✅ Refreshed 1 mission(s)`
4. Verify new mission created with fresh timeframe

### Test Timezone Change

1. Go to Account → Timezone
2. Select different timezone
3. Note mission end times in UI
4. Change timezone again
5. New missions created will use new timezone

### Test Initialization

1. Delete all missions: `DELETE FROM missions;`
2. Close and reopen app
3. Check console for: `[Mission Init] ✅ Created 12 initial missions`
4. Verify missions appear in Crew tab

## Troubleshooting

### Missions Not Refreshing

**Check Console Logs**:
```
[Mission Refresh] Checking for expired missions...
[Mission Refresh] No expired missions
```

**Possible Causes**:
- No missions have `ends_at` in the past
- Missions already refreshed
- RLS policies blocking updates

**Solution**: Manually trigger refresh or check mission `ends_at` timestamps.

### Timezone Not Saving

**Check**:
1. Profile update saves successfully
2. No console errors
3. Timezone persists after app restart

**Solution**: Verify `saveProfile()` function in `storage/sqlite.ts`.

### Wrong Timezone Calculations

**Check**:
- Device timezone settings
- JavaScript Date object behavior
- Server vs client timezone differences

**Note**: All calculations use JavaScript `Date` objects which respect device timezone.

## Future Enhancements

1. **Auto-Timezone Detection**: Detect user's timezone from device
2. **Mission Notifications**: Alert when missions are about to expire
3. **Mission History**: View past completed missions
4. **Custom Mission Schedule**: Let users choose when missions reset
5. **Timezone-Based Rewards**: Bonus points for early morning missions
6. **DST Handling**: Automatic daylight saving time adjustments
