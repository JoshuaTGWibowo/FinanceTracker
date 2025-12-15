import { supabase, getCurrentUserId, isAuthenticated } from './supabase';
import type { LeaderboardStats } from './supabase-types';
import type { Transaction, BudgetGoal } from './types';

/**
 * Sync Service
 * 
 * Calculates anonymized metrics from local SQLite data and syncs to Supabase.
 * NEVER sends actual transaction amounts or sensitive financial data.
 */

interface AnonymizedMetrics {
  savingsPercentage: number | null;
  budgetAdherenceScore: number | null;
  streakDays: number;
  transactionsLogged: number;
  totalPoints: number;
  level: number;
}

/**
 * Calculate savings percentage from transactions (anonymized)
 * Returns percentage of income that was saved (not spent)
 * @param convertAmount - Optional function to convert amounts to base currency
 */
function calculateSavingsPercentage(
  transactions: Transaction[],
  periodStart: Date,
  periodEnd: Date,
  convertAmount?: (t: Transaction) => number
): number | null {
  const periodTransactions = transactions.filter((t) => {
    const txDate = new Date(t.date);
    return txDate >= periodStart && txDate <= periodEnd;
  });

  const totalIncome = periodTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (convertAmount ? convertAmount(t) : t.amount), 0);

  const totalExpenses = periodTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (convertAmount ? convertAmount(t) : t.amount), 0);

  if (totalIncome === 0) return null;

  const saved = totalIncome - totalExpenses;
  const percentage = (saved / totalIncome) * 100;
  
  return Math.round(percentage * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate budget adherence score (0-100)
 * Measures how well user stayed within their budget goals
 * @param convertAmount - Optional function to convert amounts to base currency
 */
function calculateBudgetAdherence(
  transactions: Transaction[],
  budgetGoals: BudgetGoal[],
  periodStart: Date,
  periodEnd: Date,
  convertAmount?: (t: Transaction) => number
): number | null {
  if (budgetGoals.length === 0) return null;

  let totalScore = 0;
  let goalCount = 0;

  for (const goal of budgetGoals) {
    const categorySpending = transactions
      .filter((t) => {
        const txDate = new Date(t.date);
        return (
          t.type === 'expense' &&
          t.category === goal.category &&
          txDate >= periodStart &&
          txDate <= periodEnd
        );
      })
      .reduce((sum, t) => sum + (convertAmount ? convertAmount(t) : t.amount), 0);

    if (goal.target > 0) {
      const adherence = Math.max(0, 100 - ((categorySpending - goal.target) / goal.target) * 100);
      totalScore += Math.min(100, adherence);
      goalCount++;
    }
  }

  return goalCount > 0 ? Math.round(totalScore / goalCount) : null;
}

/**
 * Calculate consecutive days with at least one transaction
 */
function calculateStreakDays(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;

  // Sort transactions by date descending
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get unique dates with transactions
  const uniqueDates = new Set(
    sortedTransactions.map((t) => {
      const date = new Date(t.date);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
  );

  let streak = 0;
  let currentDate = today.getTime();

  // Check each consecutive day
  while (uniqueDates.has(currentDate)) {
    streak++;
    currentDate -= 24 * 60 * 60 * 1000; // Go back one day
  }

  return streak;
}

/**
 * Calculate gamification points based on activity
 * Points formula: transactions logged + (streak * 10) + (budget adherence bonus)
 */
function calculateTotalPoints(
  transactionsLogged: number,
  streakDays: number,
  budgetAdherence: number | null
): number {
  let points = transactionsLogged;
  points += streakDays * 10;
  
  if (budgetAdherence !== null && budgetAdherence >= 90) {
    points += 100; // Bonus for excellent budget adherence
  } else if (budgetAdherence !== null && budgetAdherence >= 75) {
    points += 50;
  }

  return points;
}

/**
 * Calculate user level based on total points
 */
function calculateLevel(totalPoints: number): number {
  // Simple formula: level = floor(sqrt(points / 100))
  return Math.floor(Math.sqrt(totalPoints / 100)) + 1;
}

/**
 * Calculate anonymized metrics from local data
 */
export function calculateAnonymizedMetrics(
  transactions: Transaction[],
  budgetGoals: BudgetGoal[],
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
): AnonymizedMetrics {
  const now = new Date();
  let periodStart: Date;

  switch (period) {
    case 'daily':
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      periodStart = new Date(now);
      periodStart.setMonth(now.getMonth() - 1);
      break;
    case 'all_time':
      periodStart = new Date(0); // Epoch
      break;
  }

  const savingsPercentage = calculateSavingsPercentage(transactions, periodStart, now);
  const budgetAdherenceScore = calculateBudgetAdherence(transactions, budgetGoals, periodStart, now);
  const streakDays = calculateStreakDays(transactions);
  const transactionsLogged = transactions.filter((t) => {
    const txDate = new Date(t.date);
    return txDate >= periodStart && txDate <= now;
  }).length;

  const totalPoints = calculateTotalPoints(transactionsLogged, streakDays, budgetAdherenceScore);
  const level = calculateLevel(totalPoints);

  return {
    savingsPercentage,
    budgetAdherenceScore,
    streakDays,
    transactionsLogged,
    totalPoints,
    level,
  };
}

/**
 * Sync anonymized metrics to Supabase
 * This is the ONLY data sent to the cloud - no actual amounts or sensitive info
 */
export async function syncMetricsToSupabase(
  transactions?: Transaction[],
  budgetGoals?: BudgetGoal[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Use provided data or default to empty arrays
    const txData = transactions || [];
    const budgetData = budgetGoals || [];

    // Calculate metrics for all periods
    const periods: Array<'daily' | 'weekly' | 'monthly' | 'all_time'> = [
      'daily',
      'weekly',
      'monthly',
      'all_time',
    ];

    for (const period of periods) {
      const metrics = calculateAnonymizedMetrics(txData, budgetData, period);

      const statsData: Partial<LeaderboardStats> = {
        user_id: userId,
        period,
        savings_percentage: metrics.savingsPercentage,
        budget_adherence_score: metrics.budgetAdherenceScore,
        streak_days: metrics.streakDays,
        transactions_logged: metrics.transactionsLogged,
        total_points: metrics.totalPoints,
        level: metrics.level,
        updated_at: new Date().toISOString(),
      };

      // Upsert (insert or update)
      const { error } = await supabase
        .from('leaderboard_stats')
        .upsert(statsData, {
          onConflict: 'user_id,period',
        });

      if (error) {
        console.error(`Error syncing ${period} stats:`, error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing metrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Auto-sync manager with debouncing and periodic sync
 */
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncTime = 0;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 3000; // 3 seconds
const MIN_SYNC_INTERVAL = 30 * 1000; // Minimum 30 seconds between syncs

/**
 * Start automatic periodic syncing
 */
export function startAutoSync(
  getTransactions: () => Transaction[],
  getBudgetGoals: () => BudgetGoal[]
): void {
  // Clear existing timer
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
  }

  // Set up periodic sync every 5 minutes
  autoSyncTimer = setInterval(async () => {
    const now = Date.now();
    if (now - lastSyncTime >= MIN_SYNC_INTERVAL) {
      const isAuth = await isAuthenticated();
      if (isAuth) {
        const transactions = getTransactions();
        const budgetGoals = getBudgetGoals();
        await syncMetricsToSupabase(transactions, budgetGoals);
        lastSyncTime = now;
      }
    }
  }, SYNC_INTERVAL);

  console.log('Auto-sync enabled: syncing every 5 minutes');
}

/**
 * Stop automatic syncing
 */
export function stopAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  console.log('Auto-sync disabled');
}

/**
 * Trigger an immediate sync with debouncing
 * Called after user actions like adding/editing transactions
 */
export async function triggerSync(
  transactions: Transaction[],
  budgetGoals: BudgetGoal[]
): Promise<void> {
  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Debounce: wait 3 seconds before syncing
  debounceTimer = setTimeout(async () => {
    const now = Date.now();
    
    // Respect minimum sync interval
    if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
      console.log('Sync throttled: too soon since last sync');
      return;
    }

    const isAuth = await isAuthenticated();
    if (isAuth) {
      await syncMetricsToSupabase(transactions, budgetGoals);
      lastSyncTime = now;
      console.log('Auto-sync triggered after user action');
    }
  }, DEBOUNCE_DELAY);
}

/**
 * Fetch leaderboard data from Supabase (crew members only)
 */
export async function fetchLeaderboard(
  period: 'daily' | 'weekly' | 'monthly' | 'all_time',
  limit = 100
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // First, get the user's crew
    const { data: crewData, error: crewError } = await supabase.rpc('get_user_crew');
    
    if (crewError) {
      console.error('Error getting user crew:', crewError);
      return { success: false, error: 'Not in a crew' };
    }

    if (!crewData || crewData.length === 0) {
      // User not in a crew, return empty leaderboard
      return { success: true, data: [] };
    }

    const crewId = crewData[0].crew_id;

    // Get all crew members
    const { data: members, error: membersError } = await supabase.rpc('get_crew_members', {
      p_crew_id: crewId,
    });

    if (membersError) {
      console.error('Error getting crew members:', membersError);
      return { success: false, error: membersError.message };
    }

    if (!members || members.length === 0) {
      return { success: true, data: [] };
    }

    // Get user IDs from crew members
    const crewMemberIds = members.map((m: any) => m.user_id);

    // Fetch leaderboard stats for crew members only
    const { data, error } = await supabase
      .from('leaderboard_stats')
      .select(`
        *,
        profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('period', period)
      .in('user_id', crewMemberIds)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's current rank in leaderboard (within crew only)
 */
export async function getUserRank(
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
): Promise<{ success: boolean; rank?: number; error?: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get the user's crew
    const { data: crewData, error: crewError } = await supabase.rpc('get_user_crew');
    
    if (crewError || !crewData || crewData.length === 0) {
      return { success: false, error: 'Not in a crew' };
    }

    const crewId = crewData[0].crew_id;

    // Get all crew members
    const { data: members, error: membersError } = await supabase.rpc('get_crew_members', {
      p_crew_id: crewId,
    });

    if (membersError || !members || members.length === 0) {
      return { success: false, error: 'Could not fetch crew members' };
    }

    // Get user IDs from crew members
    const crewMemberIds = members.map((m: any) => m.user_id);

    // Get user's points
    const { data: userStats, error: userError } = await supabase
      .from('leaderboard_stats')
      .select('total_points')
      .eq('user_id', userId)
      .eq('period', period)
      .single();

    if (userError || !userStats) {
      return { success: false, error: 'User stats not found' };
    }

    // Count how many CREW MEMBERS have more points
    const { count, error: countError } = await supabase
      .from('leaderboard_stats')
      .select('*', { count: 'exact', head: true })
      .eq('period', period)
      .in('user_id', crewMemberIds)
      .gt('total_points', userStats.total_points);

    if (countError) {
      return { success: false, error: countError.message };
    }

    // Rank is count of crew members with more points + 1
    const rank = (count || 0) + 1;

    return { success: true, rank };
  } catch (error) {
    console.error('Error getting user rank:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
