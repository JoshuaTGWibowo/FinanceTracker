# Timezone & Mission Refresh Setup Guide

## Overview
This guide explains how to set up timezone selection and automatic mission refresh in your Finance Tracker app.

## Setup Steps

### 1. Add Missions UPDATE Policy

Run this in your Supabase SQL Editor:

```sql
-- missions-update-policy.sql

-- Add UPDATE policy for missions to allow refreshing expired missions
DROP POLICY IF EXISTS "Active missions are viewable by everyone" ON public.missions;

-- Recreate SELECT policy
CREATE POLICY "Active missions are viewable by everyone"
  ON public.missions FOR SELECT
  USING (is_active = true);

-- Add UPDATE policy for system to refresh missions
CREATE POLICY "System can update mission timeframes"
  ON public.missions FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

### 2. Seed Initial Missions

Run `missions-seed-v2.sql` in Supabase SQL Editor to create timezone-aware missions:

```sql
-- This creates missions with proper timezone handling
-- Daily missions: 24-hour periods
-- Weekly missions: Sunday to Sunday
-- Monthly missions: 1st to 1st of next month
```

### 3. Test the Setup

1. **Change Timezone:**
   - Open the app
   - Go to Account tab
   - Scroll to "Timezone" section
   - Select "Melbourne (AEDT)" or your timezone

2. **Restart App:**
   - Close and reopen the app
   - Check console logs:
   ```
   [Mission Init] ✅ Missions found
   [Mission Refresh] Checking for expired missions...
   ```

3. **When Missions Expire:**
   - App automatically detects expired missions
   - Updates them with new timeframes based on your timezone
   - Console shows: `[Mission Refresh] ✅ Refreshed X mission(s)`

## How It Works

### Timezone Selection
- **Default:** Australia/Melbourne (AEDT)
- **Storage:** Saved in Profile
- **Effect:** All mission timers calculate relative to selected timezone

### Mission Refresh System
Runs automatically on app launch:

1. **Check for expired missions:**
   - Query: `WHERE ends_at < NOW() AND is_active = true`

2. **Update timeframes:**
   - Daily: New 24-hour period from now
   - Weekly: Current week (Sun-Sun)
   - Monthly: Current month (1st to 1st)

3. **No data loss:**
   - Old mission records kept (is_active = false)
   - New timeframes applied to same mission

### Example Flow

```
User logs in at 4:30 PM Melbourne time
↓
App checks missions
↓
Finds "Daily Logger" expired at 4:00 PM
↓
Updates mission:
  starts_at: 2025-12-09 16:30:00+11
  ends_at:   2025-12-10 16:30:00+11
↓
Mission now expires at 4:30 PM tomorrow (user's local time)
```

## Benefits

✅ **No more UTC confusion** - Missions reset at YOUR local time
✅ **Automatic refresh** - No manual intervention needed  
✅ **Timezone-aware** - Travel to different timezone? Change setting and missions adapt
✅ **Persistent** - Mission history preserved (old entries kept as inactive)
✅ **Performance** - Only checks on app launch, not on every transaction

## Troubleshooting

### Missions not refreshing?

**Check console logs:**
```
[Mission Refresh] Error updating mission: [error details]
```

**Verify RLS policy exists:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'missions' 
AND policyname = 'System can update mission timeframes';
```

**If policy missing:**
- Run `missions-update-policy.sql` again

### No missions showing up?

**Check if missions exist:**
```sql
SELECT COUNT(*) FROM missions WHERE is_active = true;
```

**If count is 0:**
- Run `missions-seed-v2.sql` to create initial missions

**Check console:**
```
[Mission Init] ⚠️ No missions found! Please run missions-seed-v2.sql
```

### Timezone not saving?

**Check Profile has timezone field:**
```sql
SELECT timezone FROM profiles WHERE id = 'your-user-id';
```

**If NULL or missing:**
- Profile was created before timezone field added
- Update manually:
```sql
UPDATE profiles 
SET timezone = 'Australia/Melbourne' 
WHERE id = 'your-user-id';
```

## Advanced: Manual Mission Refresh

If needed, you can manually trigger mission refresh:

```typescript
import { refreshExpiredMissions } from './lib/mission-refresh';

// Refresh with specific timezone
const result = await refreshExpiredMissions('Asia/Tokyo');

if (result.success) {
  console.log(`Refreshed ${result.refreshedCount} missions`);
}
```

## Database Schema

### Profile Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name TEXT,
  currency TEXT,
  timezone TEXT DEFAULT 'Australia/Melbourne',
  ...
);
```

### Missions Table
```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY,
  title TEXT,
  description TEXT,
  mission_type TEXT, -- 'individual' or 'crew'
  goal_type TEXT,    -- 'transactions_logged', 'streak', etc.
  goal_target NUMERIC,
  points_reward INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Important Notes

### Security Consideration
The current UPDATE policy allows all authenticated users to update missions:

```sql
CREATE POLICY "System can update mission timeframes"
  ON public.missions FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

**For production:**
Consider using a Supabase Edge Function with service role key instead, or restrict the policy to only update `starts_at`, `ends_at`, and `is_active` fields.

### Mission History
When missions expire and refresh:
- Old mission records are NOT deleted
- `is_active` is set to false
- User progress in `user_missions` table is preserved
- You can query old missions for statistics

### Timezone List
Available timezones in the app:
- Australia: Sydney, Melbourne, Brisbane, Perth
- Pacific: Auckland
- Asia: Jakarta, Singapore, Tokyo, Hong Kong
- Europe: London, Paris
- Americas: New York, Los Angeles, Chicago
- UTC

To add more timezones, edit `app/(tabs)/account.tsx`:
```typescript
const timezones = [
  { value: "Your/Timezone", label: "Display Name" },
  // ... existing timezones
];
```

## Files Created

1. `lib/mission-refresh.ts` - Mission refresh service
2. `missions-update-policy.sql` - RLS policy for updates
3. `missions-seed-v2.sql` - Timezone-aware mission seeds
4. `TIMEZONE_MISSION_SETUP.md` - This guide

## Files Modified

1. `lib/types.ts` - Added timezone to Profile
2. `lib/store.ts` - Added setTimezone action
3. `app/(tabs)/account.tsx` - Added timezone picker UI
4. `app/_layout.tsx` - Integrated refresh on app launch

## Next Steps

1. ✅ Run `missions-update-policy.sql` in Supabase
2. ✅ Run `missions-seed-v2.sql` in Supabase (if not done already)
3. ✅ Test timezone selection in app
4. ✅ Test mission refresh by waiting for a mission to expire
5. ✅ Monitor console logs for any errors

Need help? Check the troubleshooting section above or review the console logs for detailed error messages.
