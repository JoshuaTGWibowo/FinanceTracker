import { type Account, type Category } from "./types";

export const getActiveAccountsForCategory = (category: Category, accounts: Account[]) => {
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  if (!activeAccounts.length) {
    return [] as string[];
  }

  if (!category.activeAccountIds) {
    return activeAccounts.map((account) => account.id);
  }

  return category.activeAccountIds.filter((id) => activeAccounts.some((account) => account.id === id));
};

export const isCategoryActiveForAccount = (
  category: Category,
  accountId: string,
  accounts: Account[],
): boolean => {
  const activeIds = getActiveAccountsForCategory(category, accounts);
  return activeIds.includes(accountId);
};

/**
 * Get all child categories for a given parent category
 */
export const getChildCategories = (parentCategoryId: string, allCategories: Category[]): Category[] => {
  return allCategories.filter(cat => cat.parentCategoryId === parentCategoryId);
};

/**
 * Get all category IDs that should be included when tracking a budget category
 * (includes the parent category itself plus all its children)
 */
export const getCategoryIdsForBudget = (categoryId: string, allCategories: Category[]): string[] => {
  const ids = [categoryId];
  const children = getChildCategories(categoryId, allCategories);
  children.forEach(child => ids.push(child.id));
  return ids;
};

/**
 * Check if a category matches a budget category (including parent-child relationships)
 * Handles both category IDs and category names
 */
export const doesCategoryMatchBudget = (
  transactionCategory: string,
  budgetCategory: string,
  allCategories: Category[],
  debug = false
): boolean => {
  // Find the transaction category object
  const transactionCat = allCategories.find(c => c.id === transactionCategory || c.name === transactionCategory);
  if (!transactionCat) {
    if (debug) console.log('[Category Match] Transaction category not found:', transactionCategory);
    return false;
  }

  // Find the budget category object (could be ID or name)
  const budgetCat = allCategories.find(c => c.id === budgetCategory || c.name === budgetCategory);
  if (!budgetCat) {
    if (debug) console.log('[Category Match] Budget category not found:', budgetCategory);
    return false;
  }

  // Direct match by ID or name
  if (transactionCat.id === budgetCat.id || transactionCat.name === budgetCat.name) {
    if (debug) console.log('[Category Match] Direct match:', transactionCat.name, '===', budgetCat.name);
    return true;
  }

  // Check if transaction category is a child of budget category
  if (transactionCat.parentCategoryId === budgetCat.id) {
    if (debug) console.log('[Category Match] Child match:', transactionCat.name, 'is child of', budgetCat.name);
    return true;
  }

  if (debug) console.log('[Category Match] No match:', transactionCat.name, 'vs', budgetCat.name, '| parent:', transactionCat.parentCategoryId);
  return false;
};
