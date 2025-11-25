import dayjs from "dayjs";

import { Account, Transaction } from "./types";
import { getTransactionDelta } from "./transactions";

export interface MonthlySummary {
  income: number;
  expense: number;
  openingBalance: number;
  monthNet: number;
  postMonthNet: number;
  endingBalance: number;
}

interface MonthlySummaryOptions {
  transactions: Transaction[];
  accounts: Account[];
  visibleAccountIds: string[];
  selectedAccountId: string | null;
  startOfMonth: dayjs.Dayjs;
  endOfMonth: dayjs.Dayjs;
}

const safeInitialBalance = (value?: number) => (Number.isFinite(value) ? Number(value) : 0);

const resolveOpeningBalanceSeed = (
  accounts: Account[],
  visibleAccountIds: string[],
  selectedAccountId: string | null,
) => {
  if (selectedAccountId) {
    const account = accounts.find((item) => item.id === selectedAccountId);
    return safeInitialBalance(account?.initialBalance);
  }

  const visibleAccountSet = new Set(visibleAccountIds);
  return accounts.reduce((total, account) => {
    if (!visibleAccountSet.has(account.id)) {
      return total;
    }
    return total + safeInitialBalance(account.initialBalance);
  }, 0);
};

export const calculateMonthlySummary = ({
  transactions,
  accounts,
  visibleAccountIds,
  selectedAccountId,
  startOfMonth,
  endOfMonth,
}: MonthlySummaryOptions): MonthlySummary => {
  const seed = resolveOpeningBalanceSeed(accounts, visibleAccountIds, selectedAccountId);

  const summary = transactions.reduce(
    (acc, transaction) => {
      const date = dayjs(transaction.date);
      const delta = getTransactionDelta(transaction, selectedAccountId);

      if (date.isBefore(startOfMonth)) {
        acc.openingBalance += delta;
      } else if (!date.isAfter(endOfMonth)) {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else if (transaction.type === "expense") {
          acc.expense += transaction.amount;
        }
        acc.monthNet += delta;
      } else {
        acc.postMonthNet += delta;
      }

      return acc;
    },
    { income: 0, expense: 0, openingBalance: seed, monthNet: 0, postMonthNet: 0 },
  );

  return {
    ...summary,
    endingBalance: summary.openingBalance + summary.monthNet + summary.postMonthNet,
  };
};
