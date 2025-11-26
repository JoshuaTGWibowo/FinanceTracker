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
}

export interface MockAchievement extends Omit<Achievement, 'created_at'> {
  created_at: string;
  unlocked: boolean;
}

// Active missions with varying difficulty
export const mockMissions: MockMission[] = [
  {
    id: '1',
    title: 'Save 20% This Week',
    description: 'Keep your spending under control and save at least 20% of your income',
    mission_type: 'individual',
    goal_type: 'savings_rate',
    goal_target: 20,
    points_reward: 150,
    starts_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    is_active: true,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 65,
    icon: 'wallet',
  },
  {
    id: '2',
    title: '7-Day Logging Streak',
    description: 'Log your transactions every day for 7 consecutive days',
    mission_type: 'individual',
    goal_type: 'streak',
    goal_target: 7,
    points_reward: 200,
    starts_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 42,
    icon: 'flame',
  },
  {
    id: '3',
    title: 'Budget Master',
    description: 'Stay within your budget for all categories this month',
    mission_type: 'individual',
    goal_type: 'budget_adherence',
    goal_target: 100,
    points_reward: 300,
    starts_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 78,
    icon: 'checkmark-circle',
  },
  {
    id: '4',
    title: 'Transaction Tracker',
    description: 'Log at least 20 transactions this week',
    mission_type: 'individual',
    goal_type: 'transactions_logged',
    goal_target: 20,
    points_reward: 100,
    starts_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 30,
    icon: 'receipt',
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
