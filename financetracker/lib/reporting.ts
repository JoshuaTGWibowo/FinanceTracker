import dayjs, { Dayjs } from "dayjs";

import { RecurringTransaction, Transaction } from "./store";
import { filterTransactionsByAccount, getTransactionDelta } from "./transactions";

const formatPercentage = (current: number, previous: number): string => {
  if (previous === 0) return "—";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
};

export interface PeriodOverviewFilters {
  minAmount?: number;
  maxAmount?: number;
  selectedCategories?: string[];
  searchTerm?: string;
  startDate?: Dayjs | null;
  endDate?: Dayjs | null;
}

export interface PeriodOverviewArgs {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  visibleAccountIds: string[];
  selectedAccountId: string | null;
  range: { start: Dayjs; end: Dayjs };
  filters: PeriodOverviewFilters;
}

export interface PeriodOverviewSection {
  title: string;
  data: Array<{
    id: string;
    transactions: Transaction[];
    dailyIncome: number;
    dailyExpense: number;
    dailyNet: number;
  }>;
  dailyIncome: number;
  dailyExpense: number;
  dailyNet: number;
}

export interface CategoryBreakdownEntry {
  category: string;
  amount: number;
  percentage: number;
}

export interface PeriodOverviewResult {
  sections: PeriodOverviewSection[];
  summary: {
    income: number;
    expense: number;
    net: number;
    openingBalance: number;
    closingBalance: number;
    percentageChange: string;
  };
  expenseBreakdown: CategoryBreakdownEntry[];
  incomeBreakdown: CategoryBreakdownEntry[];
  filteredRecurring: RecurringTransaction[];
  filteredTransactions: Transaction[];
}

export const buildPeriodOverview = ({
  transactions,
  recurringTransactions,
  visibleAccountIds,
  selectedAccountId,
  range,
  filters,
}: PeriodOverviewArgs): PeriodOverviewResult => {
  const { start, end } = range;
  const {
    minAmount,
    maxAmount,
    selectedCategories = [],
    searchTerm = "",
    startDate = null,
    endDate = null,
  } = filters;

  const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);
  const scopedTransactions = filterTransactionsByAccount(transactions, selectedAccountId).filter(
    (transaction) => {
      if (!allowedAccountIds || allowedAccountIds.size === 0) {
        return true;
      }

      const fromAllowed = transaction.accountId
        ? allowedAccountIds.has(transaction.accountId)
        : false;
      const toAllowed = transaction.toAccountId
        ? allowedAccountIds.has(transaction.toAccountId)
        : false;

      return fromAllowed || toAllowed;
    },
  );

  const periodTransactions = scopedTransactions.filter((transaction) => {
    const date = dayjs(transaction.date);
    return !date.isBefore(start) && !date.isAfter(end);
  });

  const filteredTransactions = periodTransactions.filter((transaction) => {
    const date = dayjs(transaction.date);
    if (startDate && date.isBefore(startDate)) return false;
    if (endDate && date.isAfter(endDate)) return false;

    const amount = transaction.amount;
    if (typeof minAmount === "number" && amount < minAmount) return false;
    if (typeof maxAmount === "number" && amount > maxAmount) return false;

    if (selectedCategories.length && !selectedCategories.includes(transaction.category)) {
      return false;
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchesNote = transaction.note.toLowerCase().includes(query);
      const matchesCategory = transaction.category.toLowerCase().includes(query);
      const matchesLocation = transaction.location
        ? transaction.location.toLowerCase().includes(query)
        : false;
      const matchesParticipants = transaction.participants
        ? transaction.participants.some((participant) => participant.toLowerCase().includes(query))
        : false;

      if (!matchesNote && !matchesCategory && !matchesLocation && !matchesParticipants) {
        return false;
      }
    }

    return true;
  });

  const reportable = periodTransactions.filter((transaction) => !transaction.excludeFromReports);

  const parseTransactionId = (id: string) => {
    const match = id.match(/(\d+)$/);
    return match ? Number(match[1]) : null;
  };

  const sortTransactionsByRecency = (a: Transaction, b: Transaction) => {
    const dateDiff = dayjs(b.date).valueOf() - dayjs(a.date).valueOf();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const aId = parseTransactionId(a.id);
    const bId = parseTransactionId(b.id);

    if (aId !== null && bId !== null && aId !== bId) {
      return bId - aId;
    }

    if (bId !== null && aId === null) {
      return 1;
    }

    if (aId !== null && bId === null) {
      return -1;
    }

    return 0;
  };

  const grouped = new Map<
    string,
    {
      transactions: Transaction[];
      dailyIncome: number;
      dailyExpense: number;
      dailyNet: number;
    }
  >();

  filteredTransactions
    .sort(sortTransactionsByRecency)
    .forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      const existing =
        grouped.get(key) ?? {
          transactions: [],
          dailyIncome: 0,
          dailyExpense: 0,
          dailyNet: 0,
        };
      existing.transactions.push(transaction);
      if (transaction.type === "income") {
        existing.dailyIncome += transaction.amount;
        existing.dailyNet += transaction.amount;
      } else if (transaction.type === "expense") {
        existing.dailyExpense += transaction.amount;
        existing.dailyNet -= transaction.amount;
      } else {
        existing.dailyNet += getTransactionDelta(transaction, selectedAccountId);
      }
      grouped.set(key, existing);
    });

  const sections = Array.from(grouped.entries()).map(([key, value]) => ({
    title: dayjs(key).format("dddd, MMM D"),
    data: [{ ...value, id: key }],
    dailyIncome: value.dailyIncome,
    dailyExpense: value.dailyExpense,
    dailyNet: value.dailyNet,
  }));

  const totals = reportable.reduce(
    (acc, transaction) => {
      if (transaction.type === "income") {
        acc.income += transaction.amount;
      } else if (transaction.type === "expense") {
        acc.expense += transaction.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const netChange = reportable.reduce(
    (acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId),
    0,
  );

  let openingBalance = 0;
  scopedTransactions
    .filter((transaction) => !transaction.excludeFromReports)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((transaction) => {
      const value = getTransactionDelta(transaction, selectedAccountId);
      const date = dayjs(transaction.date);
      if (date.isBefore(start)) {
        openingBalance += value;
      }
    });
  const closingBalance = openingBalance + netChange;

  const breakdownForType = (type: "income" | "expense") => {
    const map = reportable.reduce((acc, transaction) => {
      if (transaction.type !== type) return acc;
      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const total = type === "income" ? totals.income : totals.expense;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total ? Math.round((amount / total) * 100) : 0,
      }));
  };

  const filteredRecurring = recurringTransactions.filter((item) => {
    const occurrence = dayjs(item.nextOccurrence);
    const matchesAccount =
      !selectedAccountId || item.accountId === selectedAccountId || item.toAccountId === selectedAccountId;
    return matchesAccount && !occurrence.isBefore(start) && !occurrence.isAfter(end);
  });

  return {
    sections,
    summary: {
      income: totals.income,
      expense: totals.expense,
      net: netChange,
      openingBalance,
      closingBalance,
      percentageChange: formatPercentage(closingBalance, openingBalance),
    },
    expenseBreakdown: breakdownForType("expense"),
    incomeBreakdown: breakdownForType("income"),
    filteredRecurring,
    filteredTransactions,
  };
};
