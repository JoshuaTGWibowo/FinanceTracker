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
 */
export const doesCategoryMatchBudget = (
  transactionCategory: string,
  budgetCategory: string,
  allCategories: Category[]
): boolean => {
  // Direct match
  if (transactionCategory === budgetCategory) {
    return true;
  }

  // Check if transaction category is a child of budget category
  const transactionCat = allCategories.find(c => c.id === transactionCategory);
  if (transactionCat?.parentCategoryId === budgetCategory) {
    return true;
  }

  return false;
};
