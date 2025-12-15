/**
 * Budget Tracking Service
 * Checks budget progress and awards points for budget completion
 */

import { awardBudgetCompletionPoints } from './points-service';
import type { Transaction, BudgetGoal, Category } from './types';
import { doesCategoryMatchBudget } from './categoryUtils';

// Store last checked dates to avoid duplicate point awards
const lastCheckedDates: Record<string, string> = {};

/**
 * Calculate current spending for a budget goal
 * @param convertAmount - Optional function to convert transaction amounts to base currency
 */
export const calculateBudgetSpending = (
  goal: BudgetGoal,
  transactions: Transaction[],
  categories: Category[],
  convertAmount?: (t: Transaction) => number
): number => {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;
  
  if (goal.period === 'week') {
    // Weekly: Monday to Sunday
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() + diffToMonday);
    periodStart.setHours(0, 0, 0, 0);
    
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    // Monthly: 1st to end of month
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  
  const goalStartDate = new Date(goal.createdAt);
  if (goalStartDate > periodEnd) {
    return 0;
  }
  
  // Filter transactions matching budget
  const matchingTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const inDateRange = txDate >= periodStart && txDate <= periodEnd;
    const isExpense = t.type === 'expense';
    const matchesCategory = doesCategoryMatchBudget(t.category, goal.category, categories, true);
    
    return isExpense && inDateRange && matchesCategory && !t.excludeFromReports;
  });
  
  // Sum amounts, using converter if provided
  const totalSpending = matchingTransactions.reduce((sum, t) => {
    const amount = convertAmount ? convertAmount(t) : t.amount;
    return sum + amount;
  }, 0);
  return totalSpending;
};

/**
 * Check if budget period has just completed successfully
 * @param convertAmount - Optional function to convert transaction amounts to base currency
 */
export const checkBudgetCompletion = async (
  goal: BudgetGoal,
  transactions: Transaction[],
  categories: Category[],
  convertAmount?: (t: Transaction) => number
): Promise<{ completed: boolean; pointsAwarded?: number }> => {
  const now = new Date();
  const currentSpending = calculateBudgetSpending(goal, transactions, categories, convertAmount);
  
  // Budget failed if over target
  if (currentSpending > goal.target) {
    return { completed: false };
  }
  
  // Check if we're at the end of the budget period
  let isEndOfPeriod = false;
  let periodKey = '';
  
  if (goal.period === 'week') {
    // End of week is Sunday
    const dayOfWeek = now.getDay();
    isEndOfPeriod = dayOfWeek === 0; // Sunday
    
    // Weekly period key: YYYY-WW (year and week number)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    periodKey = `${goal.id}-week-${weekStart.getFullYear()}-${Math.floor(weekStart.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
  } else {
    // End of month
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    isEndOfPeriod = tomorrow.getMonth() !== now.getMonth();
    
    // Monthly period key: YYYY-MM
    periodKey = `${goal.id}-month-${now.getFullYear()}-${now.getMonth()}`;
  }
  
  // Don't award points if not end of period
  if (!isEndOfPeriod) {
    return { completed: false };
  }
  
  // Check if we've already awarded points for this period
  if (lastCheckedDates[periodKey]) {
    return { completed: true, pointsAwarded: 0 };
  }
  
  // Award points for successful completion
  const result = await awardBudgetCompletionPoints({
    budgetName: goal.name,
    period: goal.period === 'week' ? 'week' : 'month',
  });
  
  if (result.success) {
    lastCheckedDates[periodKey] = now.toISOString();
    console.log(`[Budget] ✅ Completed "${goal.name}" - Awarded ${result.pointsAwarded} pts`);
  }
  
  return {
    completed: true,
    pointsAwarded: result.pointsAwarded,
  };
};

/**
 * Check for daily budget success (stayed under all daily budgets)
 * This is a simplified check - you can enhance it to track actual daily budgets
 * @param convertAmount - Optional function to convert transaction amounts to base currency
 */
export const checkDailyBudgetSuccess = async (
  budgets: BudgetGoal[],
  transactions: Transaction[],
  categories: Category[],
  convertAmount?: (t: Transaction) => number
): Promise<{ success: boolean; pointsAwarded?: number }> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `daily-${today.toISOString().split('T')[0]}`;
  
  // Check if we've already checked today
  if (lastCheckedDates[todayKey]) {
    return { success: false, pointsAwarded: 0 };
  }
  
  // Get today's transactions
  const todayTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    txDate.setHours(0, 0, 0, 0);
    return txDate.getTime() === today.getTime();
  });
  
  // If no transactions today, no need to check
  if (todayTransactions.length === 0) {
    return { success: false, pointsAwarded: 0 };
  }
  
  // Check if all budgets are under target for today
  const allUnderBudget = budgets.every(budget => {
    const spending = calculateBudgetSpending(budget, transactions, categories, convertAmount);
    const dailyTarget = budget.period === 'week' 
      ? budget.target / 7 
      : budget.target / 30;
    
    return spending <= dailyTarget;
  });
  
  if (!allUnderBudget) {
    return { success: false };
  }
  
  // Award daily budget success points
  const result = await awardBudgetCompletionPoints({
    budgetName: 'Daily Budget',
    period: 'day',
  });
  
  if (result.success) {
    lastCheckedDates[todayKey] = new Date().toISOString();
    console.log(`[Budget] ✅ Daily budget success - Awarded ${result.pointsAwarded} pts`);
  }
  
  return {
    success: true,
    pointsAwarded: result.pointsAwarded,
  };
};

/**
 * Check all budgets and award points for completions
 * @param convertAmount - Optional function to convert transaction amounts to base currency
 */
export const checkAllBudgets = async (
  budgets: BudgetGoal[],
  transactions: Transaction[],
  categories: Category[],
  convertAmount?: (t: Transaction) => number
): Promise<void> => {
  try {
    // Check each budget for completion
    for (const budget of budgets) {
      if (budget.isRepeating) {
        await checkBudgetCompletion(budget, transactions, categories, convertAmount);
      }
    }
    
    // Check daily budget success (pass converter)
    if (budgets.length > 0) {
      await checkDailyBudgetSuccess(budgets, transactions, categories, convertAmount);
    }
  } catch (err) {
    console.error('[Budget] Error checking budgets:', err);
  }
};
