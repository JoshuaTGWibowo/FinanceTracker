/**
 * Points and Leveling Service
 * Handles point calculation, level progression, and stat tracking
 */

import { supabase } from './supabase';
import type { Transaction } from './types';

// =====================================================
// CONSTANTS
// =====================================================

export const POINT_REWARDS = {
  TRANSACTION_LOGGED: 10,
  DAILY_STREAK_BONUS: 5,
  BUDGET_DAY_SUCCESS: 25,
  WEEKLY_BUDGET_COMPLETE: 100,
  MONTHLY_BUDGET_COMPLETE: 250,
  SAVINGS_TARGET_HIT: 50,
  FIRST_TRANSACTION: 50, // Bonus for first transaction
} as const;

// Level progression: Level N requires 100 * 2^(N-1) total points
// Level 1: 0-99, Level 2: 100-249, Level 3: 250-499, Level 4: 500-999, etc.
export const calculateLevel = (totalPoints: number): number => {
  if (totalPoints < 100) return 1;
  
  let level = 1;
  let pointsNeeded = 0;
  
  while (pointsNeeded <= totalPoints) {
    pointsNeeded = 100 * Math.pow(2, level - 1);
    if (totalPoints < pointsNeeded) break;
    level++;
  }
  
  return level - 1;
};

// Calculate points needed for next level
export const getPointsForNextLevel = (currentLevel: number): number => {
  return 100 * Math.pow(2, currentLevel);
};

// Calculate progress to next level (0-100%)
export const getLevelProgress = (totalPoints: number): { 
  currentLevel: number;
  progress: number;
  pointsInLevel: number;
  pointsNeeded: number;
} => {
  const currentLevel = calculateLevel(totalPoints);
  const currentLevelMin = currentLevel === 1 ? 0 : 100 * Math.pow(2, currentLevel - 2);
  const nextLevelMin = 100 * Math.pow(2, currentLevel - 1);
  
  const pointsInLevel = totalPoints - currentLevelMin;
  const pointsNeeded = nextLevelMin - currentLevelMin;
  const progress = (pointsInLevel / pointsNeeded) * 100;
  
  return {
    currentLevel,
    progress: Math.min(progress, 100),
    pointsInLevel,
    pointsNeeded,
  };
};

// =====================================================
// LEADERBOARD STATS FUNCTIONS
// =====================================================

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export type LeaderboardStats = {
  userId: string;
  period: LeaderboardPeriod;
  totalPoints: number;
  level: number;
  streakDays: number;
  transactionsLogged: number;
  savingsPercentage: number | null;
  budgetAdherenceScore: number | null;
  updatedAt: string;
};

/**
 * Get user's leaderboard stats for a specific period
 */
export const getLeaderboardStats = async (
  userId?: string,
  period: LeaderboardPeriod = 'all_time'
): Promise<{ success: boolean; stats?: LeaderboardStats; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      return { success: false, error: 'No user ID provided' };
    }

    const { data, error } = await supabase
      .from('leaderboard_stats')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('period', period)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching leaderboard stats:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      // Return default stats if none exist
      return {
        success: true,
        stats: {
          userId: targetUserId,
          period,
          totalPoints: 0,
          level: 1,
          streakDays: 0,
          transactionsLogged: 0,
          savingsPercentage: null,
          budgetAdherenceScore: null,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      stats: {
        userId: data.user_id,
        period: data.period,
        totalPoints: data.total_points || 0,
        level: data.level || 1,
        streakDays: data.streak_days || 0,
        transactionsLogged: data.transactions_logged || 0,
        savingsPercentage: data.savings_percentage,
        budgetAdherenceScore: data.budget_adherence_score,
        updatedAt: data.updated_at,
      },
    };
  } catch (err) {
    console.error('Error in getLeaderboardStats:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Award points to a user and update their stats
 */
export const awardPoints = async (params: {
  points: number;
  reason: string;
  period?: LeaderboardPeriod;
  incrementTransactions?: boolean;
}): Promise<{ 
  success: boolean; 
  newLevel?: number; 
  leveledUp?: boolean;
  totalPoints?: number;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const period = params.period || 'all_time';
    
    // Get current stats
    const currentStats = await getLeaderboardStats(user.id, period);
    if (!currentStats.success || !currentStats.stats) {
      return { success: false, error: 'Failed to fetch current stats' };
    }

    const oldLevel = currentStats.stats.level;
    const newTotalPoints = currentStats.stats.totalPoints + params.points;
    const newLevel = calculateLevel(newTotalPoints);
    const leveledUp = newLevel > oldLevel;

    // Update stats
    const updateData: any = {
      total_points: newTotalPoints,
      level: newLevel,
      updated_at: new Date().toISOString(),
    };

    if (params.incrementTransactions) {
      updateData.transactions_logged = (currentStats.stats.transactionsLogged || 0) + 1;
    }

    const { error } = await supabase
      .from('leaderboard_stats')
      .upsert({
        user_id: user.id,
        period,
        ...updateData,
      }, {
        onConflict: 'user_id,period',
      });

    if (error) {
      console.error('Error awarding points:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Points] Awarded ${params.points} pts for: ${params.reason} (Total: ${newTotalPoints})`);

    return {
      success: true,
      newLevel,
      leveledUp,
      totalPoints: newTotalPoints,
    };
  } catch (err) {
    console.error('Error in awardPoints:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Calculate and award points for logging a transaction
 */
export const awardTransactionPoints = async (
  transaction: Transaction
): Promise<{ success: boolean; pointsAwarded?: number; leveledUp?: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Check if this is user's first transaction
    const statsResult = await getLeaderboardStats(user.id, 'all_time');
    const isFirstTransaction = statsResult.success && 
                               statsResult.stats?.transactionsLogged === 0;

    const points = isFirstTransaction 
      ? POINT_REWARDS.TRANSACTION_LOGGED + POINT_REWARDS.FIRST_TRANSACTION
      : POINT_REWARDS.TRANSACTION_LOGGED;

    const result = await awardPoints({
      points,
      reason: isFirstTransaction 
        ? 'First transaction logged! 🎉' 
        : 'Transaction logged',
      period: 'all_time',
      incrementTransactions: true,
    });

    return {
      success: result.success,
      pointsAwarded: points,
      leveledUp: result.leveledUp,
      error: result.error,
    };
  } catch (err) {
    console.error('Error awarding transaction points:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Update daily streak and award streak bonus
 */
export const updateDailyStreak = async (): Promise<{ 
  success: boolean; 
  streakDays?: number;
  pointsAwarded?: number;
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const statsResult = await getLeaderboardStats(user.id, 'all_time');
    if (!statsResult.success || !statsResult.stats) {
      return { success: false, error: 'Failed to fetch stats' };
    }

    const currentStreak = statsResult.stats.streakDays || 0;
    const lastUpdate = new Date(statsResult.stats.updatedAt);
    const now = new Date();
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak = currentStreak;
    let pointsAwarded = 0;

    if (daysSinceUpdate === 0) {
      // Same day, no streak change
      return { success: true, streakDays: currentStreak, pointsAwarded: 0 };
    } else if (daysSinceUpdate === 1) {
      // Consecutive day, increment streak
      newStreak = currentStreak + 1;
      pointsAwarded = POINT_REWARDS.DAILY_STREAK_BONUS * newStreak; // Bonus scales with streak
      
      await awardPoints({
        points: pointsAwarded,
        reason: `${newStreak} day streak! 🔥`,
        period: 'all_time',
      });
    } else {
      // Streak broken, reset to 1
      newStreak = 1;
    }

    // Update streak count
    const { error } = await supabase
      .from('leaderboard_stats')
      .update({
        streak_days: newStreak,
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id)
      .eq('period', 'all_time');

    if (error) {
      console.error('Error updating streak:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Streak] Updated to ${newStreak} days (${pointsAwarded} pts awarded)`);

    return {
      success: true,
      streakDays: newStreak,
      pointsAwarded,
    };
  } catch (err) {
    console.error('Error updating daily streak:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Award points for completing budget goals
 */
export const awardBudgetCompletionPoints = async (params: {
  budgetName: string;
  period: 'day' | 'week' | 'month';
}): Promise<{ success: boolean; pointsAwarded?: number; error?: string }> => {
  try {
    let points = 0;
    let reason = '';

    switch (params.period) {
      case 'day':
        points = POINT_REWARDS.BUDGET_DAY_SUCCESS;
        reason = `Stayed under budget: ${params.budgetName} 💰`;
        break;
      case 'week':
        points = POINT_REWARDS.WEEKLY_BUDGET_COMPLETE;
        reason = `Weekly budget completed: ${params.budgetName} 🎯`;
        break;
      case 'month':
        points = POINT_REWARDS.MONTHLY_BUDGET_COMPLETE;
        reason = `Monthly budget completed: ${params.budgetName} 🏆`;
        break;
    }

    const result = await awardPoints({
      points,
      reason,
      period: 'all_time',
    });

    return {
      success: result.success,
      pointsAwarded: points,
      error: result.error,
    };
  } catch (err) {
    console.error('Error awarding budget completion points:', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Get leaderboard rankings for a crew
 */
export const getCrewLeaderboard = async (
  crewId: string,
  period: LeaderboardPeriod = 'all_time'
): Promise<{ 
  success: boolean; 
  rankings?: Array<{
    userId: string;
    username: string;
    displayName: string | null;
    totalPoints: number;
    level: number;
    rank: number;
  }>;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('get_crew_members', {
      p_crew_id: crewId,
    });

    if (error) {
      console.error('Error fetching crew leaderboard:', error);
      return { success: false, error: error.message };
    }

    const rankings = data.map((member: any, index: number) => ({
      userId: member.user_id,
      username: member.username,
      displayName: member.display_name,
      totalPoints: member.total_points || 0,
      level: member.level || 1,
      rank: index + 1,
    }));

    return { success: true, rankings };
  } catch (err) {
    console.error('Error in getCrewLeaderboard:', err);
    return { success: false, error: String(err) };
  }
};
