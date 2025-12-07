/**
 * Mock data for Crew/Missions feature testing
 */

import type { Mission, Achievement } from './supabase-types';

export interface MockMission extends Omit<Mission, 'starts_at' | 'ends_at' | 'created_at'> {
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  progress?: number; // User's current progress (0-100)
  icon: string; // Ionicons name
  period: 'daily' | 'weekly' | 'monthly'; // Mission time period
}

export interface MockAchievement extends Omit<Achievement, 'created_at'> {
  created_at: string;
  unlocked: boolean;
}

// Active missions with varying difficulty
export const mockMissions: MockMission[] = [
  // DAILY MISSIONS
  {
    id: 'd1',
    title: 'Daily Logger',
    description: 'Log at least 3 transactions today',
    mission_type: 'individual',
    goal_type: 'transactions_logged',
    goal_target: 3,
    points_reward: 50,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    progress: 67,
    icon: 'pencil',
    period: 'daily',
  },
  {
    id: 'd2',
    title: 'Daily Saver',
    description: 'Save at least 10% of today\'s income',
    mission_type: 'individual',
    goal_type: 'savings_rate',
    goal_target: 10,
    points_reward: 75,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    progress: 45,
    icon: 'wallet',
    period: 'daily',
  },
  {
    id: 'd3',
    title: 'Budget Check-in',
    description: 'Review and stay within your daily budget',
    mission_type: 'individual',
    goal_type: 'budget_adherence',
    goal_target: 100,
    points_reward: 60,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    progress: 85,
    icon: 'checkmark-circle',
    period: 'daily',
  },

  // WEEKLY MISSIONS
  {
    id: 'w1',
    title: '7-Day Streak',
    description: 'Log transactions every day for 7 consecutive days',
    mission_type: 'individual',
    goal_type: 'streak',
    goal_target: 7,
    points_reward: 200,
    starts_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 42,
    icon: 'flame',
    period: 'weekly',
  },
  {
    id: 'w2',
    title: 'Weekly Saver',
    description: 'Save at least 20% of your weekly income',
    mission_type: 'individual',
    goal_type: 'savings_rate',
    goal_target: 20,
    points_reward: 250,
    starts_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 65,
    icon: 'trending-up',
    period: 'weekly',
  },
  {
    id: 'w3',
    title: 'Transaction Master',
    description: 'Log at least 20 transactions this week',
    mission_type: 'individual',
    goal_type: 'transactions_logged',
    goal_target: 20,
    points_reward: 150,
    starts_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 30,
    icon: 'receipt',
    period: 'weekly',
  },
  {
    id: 'w4',
    title: 'Budget Keeper',
    description: 'Stay within budget for all categories this week',
    mission_type: 'individual',
    goal_type: 'budget_adherence',
    goal_target: 90,
    points_reward: 180,
    starts_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 72,
    icon: 'bar-chart',
    period: 'weekly',
  },

  // MONTHLY MISSIONS
  {
    id: 'm1',
    title: 'Budget Master',
    description: 'Stay within your budget for all categories this month',
    mission_type: 'individual',
    goal_type: 'budget_adherence',
    goal_target: 100,
    points_reward: 500,
    starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 78,
    icon: 'trophy',
    period: 'monthly',
  },
  {
    id: 'm2',
    title: 'Super Saver',
    description: 'Save at least 30% of your monthly income',
    mission_type: 'individual',
    goal_type: 'savings_rate',
    goal_target: 30,
    points_reward: 600,
    starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 54,
    icon: 'cash',
    period: 'monthly',
  },
  {
    id: 'm3',
    title: 'Monthly Marathon',
    description: 'Log at least 50 transactions this month',
    mission_type: 'individual',
    goal_type: 'transactions_logged',
    goal_target: 50,
    points_reward: 400,
    starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 48,
    icon: 'calendar',
    period: 'monthly',
  },
  {
    id: 'm4',
    title: 'Streak Legend',
    description: 'Maintain a 30-day transaction logging streak',
    mission_type: 'individual',
    goal_type: 'streak',
    goal_target: 30,
    points_reward: 800,
    starts_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 20,
    icon: 'flame-outline',
    period: 'monthly',
  },
];

// Crew missions (collaborative challenges)
export const mockCrewMissions: MockMission[] = [
  // DAILY CREW MISSIONS
  {
    id: 'cd1',
    title: 'Team Loggers',
    description: 'Crew members log a combined 20 transactions today',
    mission_type: 'crew',
    goal_type: 'transactions_logged',
    goal_target: 20,
    points_reward: 150,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    progress: 70,
    icon: 'people',
    period: 'daily',
  },
  {
    id: 'cd2',
    title: 'Crew Savers',
    description: 'Crew achieves average 15% savings rate today',
    mission_type: 'crew',
    goal_type: 'savings_rate',
    goal_target: 15,
    points_reward: 200,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    progress: 55,
    icon: 'shield',
    period: 'daily',
  },

  // WEEKLY CREW MISSIONS
  {
    id: 'cw1',
    title: 'United Front',
    description: 'All crew members log at least one transaction every day this week',
    mission_type: 'crew',
    goal_type: 'streak',
    goal_target: 7,
    points_reward: 500,
    starts_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 38,
    icon: 'ribbon',
    period: 'weekly',
  },
  {
    id: 'cw2',
    title: 'Budget Champions',
    description: 'Crew achieves 85%+ average budget adherence this week',
    mission_type: 'crew',
    goal_type: 'budget_adherence',
    goal_target: 85,
    points_reward: 600,
    starts_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 62,
    icon: 'trophy',
    period: 'weekly',
  },
  {
    id: 'cw3',
    title: 'Transaction Storm',
    description: 'Crew logs a combined 100 transactions this week',
    mission_type: 'crew',
    goal_type: 'transactions_logged',
    goal_target: 100,
    points_reward: 400,
    starts_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 48,
    icon: 'flash',
    period: 'weekly',
  },

  // MONTHLY CREW MISSIONS
  {
    id: 'cm1',
    title: 'Elite Squad',
    description: 'All crew members reach Level 5 or higher this month',
    mission_type: 'crew',
    goal_type: 'transactions_logged',
    goal_target: 200,
    points_reward: 1500,
    starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 65,
    icon: 'star',
    period: 'monthly',
  },
  {
    id: 'cm2',
    title: 'Savings Dynasty',
    description: 'Crew achieves 25%+ average savings rate this month',
    mission_type: 'crew',
    goal_type: 'savings_rate',
    goal_target: 25,
    points_reward: 2000,
    starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 42,
    icon: 'diamond',
    period: 'monthly',
  },
  {
    id: 'cm3',
    title: 'Marathon Masters',
    description: 'Crew logs a combined 300 transactions this month',
    mission_type: 'crew',
    goal_type: 'transactions_logged',
    goal_target: 300,
    points_reward: 1200,
    starts_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 58,
    icon: 'flag',
    period: 'monthly',
  },
  {
    id: 'cm4',
    title: 'Unstoppable Force',
    description: 'Maintain crew-wide 90%+ budget adherence all month',
    mission_type: 'crew',
    goal_type: 'budget_adherence',
    goal_target: 90,
    points_reward: 2500,
    starts_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 33,
    icon: 'medal',
    period: 'monthly',
  },
];

// Available achievements
export const mockAchievements: MockAchievement[] = [
  {
    id: '1',
    title: 'First Steps',
    description: 'Log your first transaction',
    icon: '🎯',
    points_value: 50,
    criteria_type: 'transactions_logged',
    criteria_value: 1,
    created_at: new Date().toISOString(),
    unlocked: true,
  },
  {
    id: '2',
    title: 'Budget Beginner',
    description: 'Create your first budget',
    icon: '📊',
    points_value: 100,
    criteria_type: 'budgets_created',
    criteria_value: 1,
    created_at: new Date().toISOString(),
    unlocked: true,
  },
  {
    id: '3',
    title: 'Saving Streak',
    description: 'Maintain a 7-day logging streak',
    icon: '🔥',
    points_value: 200,
    criteria_type: 'streak',
    criteria_value: 7,
    created_at: new Date().toISOString(),
    unlocked: false,
  },
  {
    id: '4',
    title: 'Budget Master',
    description: 'Stay within budget for a full month',
    icon: '👑',
    points_value: 500,
    criteria_type: 'budget_adherence_streak',
    criteria_value: 30,
    created_at: new Date().toISOString(),
    unlocked: false,
  },
  {
    id: '5',
    title: 'Super Saver',
    description: 'Save 50% of your income',
    icon: '💎',
    points_value: 1000,
    criteria_type: 'savings_rate',
    criteria_value: 50,
    created_at: new Date().toISOString(),
    unlocked: false,
  },
  {
    id: '6',
    title: 'Century Club',
    description: 'Log 100 transactions',
    icon: '💯',
    points_value: 300,
    criteria_type: 'transactions_logged',
    criteria_value: 100,
    created_at: new Date().toISOString(),
    unlocked: false,
  },
];

// Calculate level from points (simple formula)
export function calculateLevel(points: number): number {
  return Math.floor(Math.sqrt(points / 100)) + 1;
}

// Calculate points needed for next level
export function pointsForNextLevel(currentLevel: number): number {
  return Math.pow(currentLevel, 2) * 100;
}

// Calculate progress to next level (0-100)
export function levelProgress(currentPoints: number, currentLevel: number): number {
  const currentLevelMinPoints = Math.pow(currentLevel - 1, 2) * 100;
  const nextLevelMinPoints = pointsForNextLevel(currentLevel);
  const pointsIntoLevel = currentPoints - currentLevelMinPoints;
  const pointsNeeded = nextLevelMinPoints - currentLevelMinPoints;
  return Math.min(100, Math.max(0, (pointsIntoLevel / pointsNeeded) * 100));
}

// Get time remaining for mission
export function getTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes}m left`;
}

// Mock leaderboard data for testing/demo
export const mockLeaderboardData = [
  {
    user_id: '1',
    total_points: 2450,
    level: 15,
    streak_days: 28,
    profiles: { username: 'FinanceNinja', display_name: 'Finance Ninja' }
  },
  {
    user_id: '2',
    total_points: 1820,
    level: 13,
    streak_days: 15,
    profiles: { username: 'BudgetMaster', display_name: 'Budget Master' }
  },
  {
    user_id: '3',
    total_points: 1560,
    level: 12,
    streak_days: 21,
    profiles: { username: 'SavingsKing', display_name: 'Savings King' }
  },
  {
    user_id: '4',
    total_points: 1340,
    level: 11,
    streak_days: 12,
    profiles: { username: 'MoneyWise', display_name: 'Money Wise' }
  },
  {
    user_id: '5',
    total_points: 1150,
    level: 10,
    streak_days: 18,
    profiles: { username: 'FrugalQueen', display_name: 'Frugal Queen' }
  },
  {
    user_id: '6',
    total_points: 980,
    level: 9,
    streak_days: 9,
    profiles: { username: 'CashFlow', display_name: 'Cash Flow' }
  },
  {
    user_id: '7',
    total_points: 850,
    level: 9,
    streak_days: 5,
    profiles: { username: 'Josh77', display_name: 'Josh77' }
  },
  {
    user_id: '8',
    total_points: 720,
    level: 8,
    streak_days: 14,
    profiles: { username: 'InvestPro', display_name: 'Invest Pro' }
  },
  {
    user_id: '9',
    total_points: 650,
    level: 8,
    streak_days: 6,
    profiles: { username: 'SmartSpender', display_name: 'Smart Spender' }
  },
  {
    user_id: '10',
    total_points: 520,
    level: 7,
    streak_days: 11,
    profiles: { username: 'WealthBuilder', display_name: 'Wealth Builder' }
  },
];
