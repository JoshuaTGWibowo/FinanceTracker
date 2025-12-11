/**
 * Mission Refresh Service
 * Handles automatic refreshing/resetting of expired missions
 */

import { supabase } from './supabase';
import type { Mission } from './mission-service';

/**
 * Check for expired missions and create new ones
 * Should be called on app launch or periodically
 */
export const refreshExpiredMissions = async (
  userTimezone: string = 'Australia/Melbourne'
): Promise<{ success: boolean; refreshedCount?: number; error?: string }> => {
  try {
    console.log('[Mission Refresh] Checking for expired missions...');

    // Get all missions
    const { data: missions, error: fetchError } = await supabase
      .from('missions')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      console.error('[Mission Refresh] Error fetching missions:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!missions || missions.length === 0) {
      console.log('[Mission Refresh] No active missions found');
      return { success: true, refreshedCount: 0 };
    }

    const now = new Date();
    const expiredMissions = missions.filter(m => {
      if (!m.ends_at) return false;
      return new Date(m.ends_at) < now;
    });

    if (expiredMissions.length === 0) {
      console.log('[Mission Refresh] No expired missions');
      return { success: true, refreshedCount: 0 };
    }

    console.log(`[Mission Refresh] Found ${expiredMissions.length} expired mission(s)`);

    // For each expired mission, update it with new timeframe and reset user progress
    for (const mission of expiredMissions) {
      const timeframe = getTimeframeFromDescription(mission.description);
      const { starts_at, ends_at } = calculateNewTimeframe(timeframe, userTimezone);

      // Update mission timeframe
      const { error: updateError } = await supabase
        .from('missions')
        .update({
          starts_at,
          ends_at,
          is_active: true,
        })
        .eq('id', mission.id);

      if (updateError) {
        console.error(`[Mission Refresh] Error updating mission ${mission.id}:`, updateError);
        continue;
      }

      // Reset all user progress for this mission
      const { error: resetError } = await supabase
        .from('user_missions')
        .delete()
        .eq('mission_id', mission.id);

      if (resetError) {
        console.error(`[Mission Refresh] Error resetting progress for mission ${mission.id}:`, resetError);
      } else {
        console.log(`[Mission Refresh] Reset progress for "${mission.title}"`);
      }
    }

    console.log(`[Mission Refresh] ✅ Refreshed ${expiredMissions.length} mission(s)`);

    return { success: true, refreshedCount: expiredMissions.length };
  } catch (err) {
    console.error('[Mission Refresh] Unexpected error:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Determine timeframe from mission description
 */
function getTimeframeFromDescription(description: string): 'daily' | 'weekly' | 'monthly' {
  const lower = description.toLowerCase();
  if (lower.includes('today') || lower.includes('day') && !lower.includes('week') && !lower.includes('month')) {
    return 'daily';
  }
  if (lower.includes('week')) {
    return 'weekly';
  }
  return 'monthly';
}

/**
 * Calculate new start and end times based on timeframe
 */
function calculateNewTimeframe(
  timeframe: 'daily' | 'weekly' | 'monthly',
  timezone: string
): { starts_at: string; ends_at: string } {
  const now = new Date();

  if (timeframe === 'daily') {
    // Daily: 24 hours from now
    const starts_at = now.toISOString();
    const ends_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    return { starts_at, ends_at };
  }

  if (timeframe === 'weekly') {
    // Weekly: Start of current week to end of week (Sunday to Sunday)
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return {
      starts_at: startOfWeek.toISOString(),
      ends_at: endOfWeek.toISOString(),
    };
  }

  // Monthly: Start of current month to start of next month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    starts_at: startOfMonth.toISOString(),
    ends_at: startOfNextMonth.toISOString(),
  };
}

/**
 * Initialize missions for a new user or if no missions exist
 * Note: This only checks if missions exist. You need to run missions-seed-v2.sql
 * in Supabase to create the initial missions.
 */
export const initializeMissions = async (
  userTimezone: string = 'Australia/Melbourne'
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[Mission Init] Checking if missions exist...');

    // Check if any active missions exist
    const { data: existingMissions, error: fetchError } = await supabase
      .from('missions')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (existingMissions && existingMissions.length > 0) {
      console.log('[Mission Init] ✅ Missions found');
      return { success: true };
    }

    console.warn('[Mission Init] ⚠️  No missions found! Please run missions-seed-v2.sql in Supabase.');
    return { success: true };
  } catch (err) {
    console.error('[Mission Init] Unexpected error:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Create initial mission set
 */
function createInitialMissions(timezone: string) {
  const now = new Date();

  // Daily missions
  const daily = [
    { title: 'Daily Logger', description: 'Log 3 transactions today', goal_target: 3, points: 15, goal_type: 'transactions_logged' },
    { title: 'Active Tracker', description: 'Log 5 transactions today', goal_target: 5, points: 25, goal_type: 'transactions_logged' },
    { title: 'Budget Conscious', description: 'Stay within budget today', goal_target: 100, points: 20, goal_type: 'budget_adherence' },
    { title: 'Daily Saver', description: 'Save at least 10% of your income today', goal_target: 10, points: 30, goal_type: 'savings_rate' },
  ];

  // Weekly missions
  const weekly = [
    { title: 'Week Warrior', description: 'Maintain a 7-day logging streak', goal_target: 7, points: 100, goal_type: 'streak' },
    { title: 'Weekly Tracker', description: 'Log 20 transactions this week', goal_target: 20, points: 75, goal_type: 'transactions_logged' },
    { title: 'Budget Week', description: 'Stay within budget all week', goal_target: 100, points: 150, goal_type: 'budget_adherence' },
    { title: 'Weekly Savings Goal', description: 'Save 15% of your weekly income', goal_target: 15, points: 100, goal_type: 'savings_rate' },
  ];

  // Monthly missions
  const monthly = [
    { title: 'Month Dedication', description: 'Maintain a 30-day logging streak', goal_target: 30, points: 500, goal_type: 'streak' },
    { title: 'Monthly Tracker', description: 'Log 100 transactions this month', goal_target: 100, points: 300, goal_type: 'transactions_logged' },
    { title: 'Budget Master', description: 'Stay within budget all month', goal_target: 100, points: 750, goal_type: 'budget_adherence' },
    { title: 'Monthly Savings Target', description: 'Save 20% of your monthly income', goal_target: 20, points: 400, goal_type: 'savings_rate' },
  ];

  const missions: any[] = [];

  // Add daily missions
  daily.forEach(m => {
    const { starts_at, ends_at } = calculateNewTimeframe('daily', timezone);
    missions.push({
      title: m.title,
      description: m.description,
      mission_type: 'individual',
      goal_type: m.goal_type,
      goal_target: m.goal_target,
      points_reward: m.points,
      starts_at,
      ends_at,
      is_active: true,
    });
  });

  // Add weekly missions
  weekly.forEach(m => {
    const { starts_at, ends_at } = calculateNewTimeframe('weekly', timezone);
    missions.push({
      title: m.title,
      description: m.description,
      mission_type: 'individual',
      goal_type: m.goal_type,
      goal_target: m.goal_target,
      points_reward: m.points,
      starts_at,
      ends_at,
      is_active: true,
    });
  });

  // Add monthly missions
  monthly.forEach(m => {
    const { starts_at, ends_at } = calculateNewTimeframe('monthly', timezone);
    missions.push({
      title: m.title,
      description: m.description,
      mission_type: 'individual',
      goal_type: m.goal_type,
      goal_target: m.goal_target,
      points_reward: m.points,
      starts_at,
      ends_at,
      is_active: true,
    });
  });

  return missions;
}
