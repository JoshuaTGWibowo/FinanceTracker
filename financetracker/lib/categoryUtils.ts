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
