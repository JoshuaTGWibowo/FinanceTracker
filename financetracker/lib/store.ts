import { create } from "zustand";

import {
  type Account,
  type AccountType,
  type BudgetGoal,
  type Category,
  type CategoryType,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_CATEGORIES,
  type Preferences,
  type Profile,
  type RecurringTransaction,
  type ThemeMode,
  type Transaction,
  type TransactionType,
  createDefaultAccount,
} from "./types";
import {
  clearAllData,
  deleteBudgetGoal,
  deleteTransaction,
  fetchFinanceState,
  saveAccount,
  saveBudgetGoal,
  saveCategory,
  saveProfile,
  saveRecurringTransaction,
  saveThemeMode,
  saveTransaction,
} from "./storage/sqlite";
import { generateAllMockData } from "./mockData";
import { triggerSync } from "./sync-service";

export interface FinanceState {
  profile: Profile;
  preferences: Preferences;
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  budgetGoals: BudgetGoal[];
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  isHydrated: boolean;
  isHydrating: boolean;
  categoryFormDraft: {
    id?: string;
    name: string;
    type: CategoryType;
    icon: string;
    parentCategoryId: string | null;
    activeAccountIds: string[] | null;
  } | null;
  hydrateFromDatabase: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, "id">) => Promise<void>;
  updateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, "id">>,
  ) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  duplicateTransaction: (id: string) => Promise<void>;
  addRecurringTransaction: (
    transaction: Omit<RecurringTransaction, "id" | "nextOccurrence"> & {
      nextOccurrence: string;
    },
  ) => Promise<void>;
  toggleRecurringTransaction: (id: string, active?: boolean) => Promise<void>;
  logRecurringTransaction: (id: string) => Promise<void>;
  addBudgetGoal: (goal: Omit<BudgetGoal, "id">) => Promise<void>;
  updateBudgetGoal: (id: string, updates: Partial<Omit<BudgetGoal, "id">>) => Promise<void>;
  removeBudgetGoal: (id: string) => Promise<void>;
  updateProfile: (payload: Partial<Profile>) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  addCategory: (category: Omit<Category, "id">) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Omit<Category, "id">>) => Promise<void>;
  setCategoryFormDraft: (
    updates: Partial<{
      id?: string;
      name: string;
      type: CategoryType;
      icon: string;
      parentCategoryId: string | null;
      activeAccountIds: string[] | null;
    }>,
  ) => void;
  resetCategoryFormDraft: (
    initial?: Partial<{
      id?: string;
      name: string;
      type: CategoryType;
      icon: string;
      parentCategoryId: string | null;
      activeAccountIds: string[] | null;
    }>,
  ) => void;
  addAccount: (
    account: {
      name: string;
      type: AccountType;
      currency?: string;
      initialBalance?: number;
      excludeFromTotal?: boolean;
    },
  ) => Promise<void>;
  updateAccount: (
    id: string,
    updates: Partial<
      Pick<Account, "name" | "type" | "isArchived" | "currency" | "initialBalance" | "excludeFromTotal">
    >,
  ) => Promise<void>;
  archiveAccount: (id: string, archived?: boolean) => Promise<void>;
  loadMockData: () => Promise<void>;
  clearAllDataAndReload: () => Promise<void>;
}

const applyAccountBalanceUpdate = (state: FinanceState, transactions: Transaction[]) => ({
  transactions,
  accounts: recalculateAccountBalances(state.accounts, transactions, state.profile.currency),
});

const generateId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;

const recalculateAccountBalances = (
  accounts: Account[],
  transactions: Transaction[],
  fallbackCurrency: string,
): Account[] => {
  const base = accounts.map((account) => ({
    ...account,
    initialBalance: Number.isFinite(account.initialBalance) ? account.initialBalance : 0,
    currency: account.currency || fallbackCurrency,
    excludeFromTotal: account.excludeFromTotal ?? false,
    balance: 0,
  }));
  const extras: Account[] = [];

  const ensureAccount = (accountId?: string | null) => {
    if (!accountId) {
      return undefined;
    }

    let account = base.find((item) => item.id === accountId);
    if (!account) {
      account = extras.find((item) => item.id === accountId);
    }

    if (!account) {
      account = {
        id: accountId,
        name: "Legacy account",
        type: "cash",
        balance: 0,
        initialBalance: 0,
        currency: fallbackCurrency,
        excludeFromTotal: true,
        isArchived: true,
        createdAt: new Date().toISOString(),
      };
      extras.push(account);
    }

    return account;
  };

  transactions.forEach((transaction) => {
    const primary = ensureAccount(transaction.accountId);
    if (!primary) {
      return;
    }

    if (transaction.type === "income") {
      primary.balance += transaction.amount;
    } else if (transaction.type === "expense") {
      primary.balance -= transaction.amount;
    } else if (transaction.type === "transfer") {
      primary.balance -= transaction.amount;
      const destination = ensureAccount(transaction.toAccountId);
      if (destination) {
        destination.balance += transaction.amount;
      }
    }
  });

  return [...base, ...extras];
};

const normalizeDateOnly = (value: string | undefined) => {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const createInitialBalanceTransaction = (account: Account): Transaction | null => {
  const amount = Number.isFinite(account.initialBalance)
    ? Math.round(account.initialBalance * 100) / 100
    : 0;

  if (!amount) {
    return null;
  }

  const type: TransactionType = amount >= 0 ? "income" : "expense";

  return {
    id: generateId("t"),
    amount: Math.abs(amount),
    note: "Initial balance",
    type,
    category: "Initial Balance",
    date: normalizeDateOnly(account.createdAt),
    accountId: account.id,
    toAccountId: null,
  };
};

const ensureInitialBalanceTransactions = async (
  accounts: Account[],
  transactions: Transaction[],
): Promise<Transaction[]> => {
  const nextTransactions = [...transactions];

  for (const account of accounts) {
    const initialTransaction = createInitialBalanceTransaction(account);
    if (!initialTransaction) {
      continue;
    }

    const hasInitialBalanceTransaction = nextTransactions.some(
      (transaction) =>
        transaction.accountId === account.id &&
        transaction.note.trim().toLowerCase() === "initial balance" &&
        transaction.type === initialTransaction.type,
    );

    if (hasInitialBalanceTransaction) {
      continue;
    }

    await saveTransaction(initialTransaction);
    nextTransactions.push(initialTransaction);
  }

  return nextTransactions;
};

const nextOccurrenceForFrequency = (fromDate: string, frequency: RecurringTransaction["frequency"]) => {
  const base = new Date(fromDate);
  if (frequency === "weekly") {
    base.setDate(base.getDate() + 7);
  } else if (frequency === "biweekly") {
    base.setDate(base.getDate() + 14);
  } else {
    base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString();
};

export const useFinanceStore = create<FinanceState>((set, get) => ({
  profile: {
    name: "Alicia Jeanelly",
    currency: "USD",
  },
  preferences: {
    themeMode: "dark",
    categories: [...DEFAULT_CATEGORIES],
  },
  accounts: [createDefaultAccount("USD")],
  transactions: [],
  recurringTransactions: [],
  budgetGoals: [],
  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),
  isHydrated: false,
  isHydrating: false,
  categoryFormDraft: null,
  hydrateFromDatabase: async () => {
    if (get().isHydrated || get().isHydrating) {
      return;
    }

    set({ isHydrating: true });
    try {
      const data = await fetchFinanceState();
      const sourceAccounts = data.accounts.length
        ? data.accounts
        : [createDefaultAccount(data.profile.currency || "USD")];
      const transactionsWithInitialBalance = await ensureInitialBalanceTransactions(
        sourceAccounts,
        data.transactions,
      );
      const normalizedAccounts = recalculateAccountBalances(
        sourceAccounts,
        transactionsWithInitialBalance,
        data.profile.currency,
      );

      set({
        profile: data.profile,
        preferences: data.preferences,
        accounts: normalizedAccounts,
        transactions: transactionsWithInitialBalance,
        recurringTransactions: data.recurringTransactions,
        budgetGoals: data.budgetGoals,
        isHydrated: true,
        isHydrating: false,
      });
    } catch (error) {
      console.error(error);
      set({ isHydrating: false });
    }
  },
  addTransaction: async (transaction) => {
    const normalizedDate = new Date(transaction.date);
    normalizedDate.setHours(0, 0, 0, 0);

    const normalizedParticipants = transaction.participants
      ? transaction.participants.map((person) => person.trim()).filter(Boolean)
      : [];

    const normalizedPhotos = transaction.photos ? transaction.photos.filter(Boolean) : [];

    const normalizedAmount = Math.round(transaction.amount * 100) / 100;
    const normalizedAccountId = transaction.accountId || DEFAULT_ACCOUNT_ID;
    const normalizedToAccountId = transaction.toAccountId || null;
    const normalizedCategory =
      transaction.type === "transfer" ? transaction.category || "Transfer" : transaction.category;

    const payload: Transaction = {
      id: generateId("t"),
      ...transaction,
      category: normalizedCategory,
      participants: normalizedParticipants,
      photos: normalizedPhotos,
      excludeFromReports: Boolean(transaction.excludeFromReports),
      amount: normalizedAmount,
      note: transaction.note.trim(),
      date: normalizedDate.toISOString(),
      accountId: normalizedAccountId,
      toAccountId: transaction.type === "transfer" ? normalizedToAccountId : null,
    };

    await saveTransaction(payload);

    set((state) => {
      const nextTransactions = [payload, ...state.transactions];
      return applyAccountBalanceUpdate(state, nextTransactions);
    });

    // Trigger auto-sync after adding transaction
    const state = get();
    triggerSync(state.transactions, state.budgetGoals);
  },
  updateTransaction: async (id, updates) => {
    set((state) => {
      const nextTransactions = state.transactions.map((transaction) => {
        if (transaction.id !== id) {
          return transaction;
        }

        const next: Transaction = {
          ...transaction,
          ...updates,
        };

        if (updates.note !== undefined) {
          next.note = updates.note.trim();
        }

        if (updates.participants !== undefined) {
          next.participants = updates.participants
            .map((person) => person.trim())
            .filter(Boolean);
        }

        if (updates.photos !== undefined) {
          next.photos = updates.photos.filter(Boolean);
        }

        if (updates.location !== undefined) {
          next.location = updates.location.trim() || undefined;
        }

        if (updates.excludeFromReports !== undefined) {
          next.excludeFromReports = Boolean(updates.excludeFromReports);
        }

        if (updates.amount !== undefined) {
          next.amount = Math.round(updates.amount * 100) / 100;
        }

        if (updates.date !== undefined) {
          const normalized = new Date(updates.date);
          normalized.setHours(0, 0, 0, 0);
          next.date = normalized.toISOString();
        }

        if (updates.accountId !== undefined) {
          next.accountId = updates.accountId || DEFAULT_ACCOUNT_ID;
        }

        if (updates.toAccountId !== undefined) {
          next.toAccountId = updates.toAccountId || null;
        }

        if (updates.type !== undefined && updates.type !== "transfer") {
          next.toAccountId = null;
        }

        if (next.type === "transfer") {
          next.category = next.category || "Transfer";
        }

        return next;
      });

      return applyAccountBalanceUpdate(state, nextTransactions);
    });

    // Trigger auto-sync after updating transaction
    const state = get();
    triggerSync(state.transactions, state.budgetGoals);
  },
  removeTransaction: async (id) => {
    await deleteTransaction(id);
    set((state) => {
      const nextTransactions = state.transactions.filter((transaction) => transaction.id !== id);
      return applyAccountBalanceUpdate(state, nextTransactions);
    });

    // Trigger auto-sync after removing transaction
    const state = get();
    triggerSync(state.transactions, state.budgetGoals);
  },
  duplicateTransaction: async (id) => {
    const existing = get().transactions.find((transaction) => transaction.id === id);
    if (!existing) {
      return;
    }

    const copy: Omit<Transaction, "id"> = {
      amount: existing.amount,
      note: existing.note,
      type: existing.type,
      category: existing.category,
      date: existing.date,
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
      participants: existing.participants ? [...existing.participants] : undefined,
      location: existing.location,
      photos: existing.photos ? [...existing.photos] : undefined,
      excludeFromReports: existing.excludeFromReports,
    };

    await get().addTransaction(copy);
  },
  addRecurringTransaction: async (transaction) => {
    const normalizedStart = new Date(transaction.nextOccurrence);
    normalizedStart.setHours(0, 0, 0, 0);
    const startDateIso = normalizedStart.toISOString();

    const existingTransactions = get().transactions;
    const alreadyLogged = existingTransactions.some(
      (entry) =>
        entry.date === startDateIso &&
        entry.amount === transaction.amount &&
        entry.type === transaction.type &&
        entry.category === transaction.category &&
        entry.note === transaction.note.trim(),
    );

    const nextOccurrence = alreadyLogged
      ? nextOccurrenceForFrequency(startDateIso, transaction.frequency)
      : startDateIso;

    const normalizedAccountId = transaction.accountId || DEFAULT_ACCOUNT_ID;
    const normalizedToAccountId = transaction.type === "transfer" ? transaction.toAccountId || null : null;

    const payload: RecurringTransaction = {
      id: generateId("r"),
      ...transaction,
      accountId: normalizedAccountId,
      toAccountId: normalizedToAccountId,
      nextOccurrence,
      isActive: true,
    };

    await saveRecurringTransaction(payload);

    set((state) => ({
      recurringTransactions: [...state.recurringTransactions, payload],
    }));
  },
  toggleRecurringTransaction: async (id, active) => {
    const existing = get().recurringTransactions.find((item) => item.id === id);
    if (!existing) {
      return;
    }

    const next: RecurringTransaction = {
      ...existing,
      isActive: typeof active === "boolean" ? active : !existing.isActive,
    };

    await saveRecurringTransaction(next);

    set((state) => ({
      recurringTransactions: state.recurringTransactions.map((item) =>
        item.id === id ? next : item,
      ),
    }));
  },
  logRecurringTransaction: async (id) => {
    const store = get();
    const recurring = store.recurringTransactions.find((item) => item.id === id);
    if (!recurring) {
      return;
    }

    const nextOccurrence = nextOccurrenceForFrequency(recurring.nextOccurrence, recurring.frequency);

    const entry: Transaction = {
      id: generateId("t"),
      amount: recurring.amount,
      note: recurring.note,
      type: recurring.type,
      category: recurring.category || (recurring.type === "transfer" ? "Transfer" : ""),
      date: recurring.nextOccurrence,
      accountId: recurring.accountId || DEFAULT_ACCOUNT_ID,
      toAccountId: recurring.type === "transfer" ? recurring.toAccountId || null : null,
    };

    await saveTransaction(entry);
    await saveRecurringTransaction({ ...recurring, nextOccurrence });

    set((state) => {
      const nextTransactions = [entry, ...state.transactions];
      const accountUpdate = applyAccountBalanceUpdate(state, nextTransactions);

      return {
        ...accountUpdate,
        recurringTransactions: state.recurringTransactions.map((item) =>
          item.id === id
            ? {
              ...item,
              nextOccurrence,
            }
            : item,
        ),
      };
    });
  },
  addBudgetGoal: async (goal) => {
    const payload: BudgetGoal = {
      id: generateId("g"),
      ...goal,
    };

    await saveBudgetGoal(payload);

    set((state) => ({
      budgetGoals: [...state.budgetGoals, payload],
    }));
  },
  updateBudgetGoal: async (id, updates) => {
    const existing = get().budgetGoals.find((goal) => goal.id === id);
    if (!existing) {
      return;
    }

    const next: BudgetGoal = {
      ...existing,
      ...updates,
    };

    await saveBudgetGoal(next);

    set((state) => ({
      budgetGoals: state.budgetGoals.map((goal) => (goal.id === id ? next : goal)),
    }));
  },
  removeBudgetGoal: async (id) => {
    await deleteBudgetGoal(id);
    set((state) => ({
      budgetGoals: state.budgetGoals.filter((goal) => goal.id !== id),
    }));
  },
  updateProfile: async (payload) => {
    const current = get().profile;
    const nextProfile: Profile = {
      ...current,
      ...payload,
    };

    await saveProfile(nextProfile);

    set({ profile: nextProfile });
  },
  setThemeMode: async (mode) => {
    await saveThemeMode(mode);
    set((state) => ({
      preferences: {
        ...state.preferences,
        themeMode: mode,
      },
    }));
  },
  setCategoryFormDraft: (updates) =>
    set((state) => {
      const activeAccounts = state.accounts.filter((account) => !account.isArchived);
      const baseDraft =
        state.categoryFormDraft ?? {
          id: undefined,
          name: "",
          type: "expense" as CategoryType,
          icon: "pricetag",
          parentCategoryId: null,
          activeAccountIds: activeAccounts.map((account) => account.id),
        };

      return {
        categoryFormDraft: {
          ...baseDraft,
          ...updates,
        },
      };
    }),
  resetCategoryFormDraft: (initial) =>
    set((state) => {
      const activeAccounts = state.accounts.filter((account) => !account.isArchived);
      return {
        categoryFormDraft: {
          id: initial?.id,
          name: initial?.name ?? "",
          type: initial?.type ?? (state.categoryFormDraft?.type ?? "expense"),
          icon: initial?.icon ?? "pricetag",
          parentCategoryId: initial?.parentCategoryId ?? null,
          activeAccountIds: initial?.activeAccountIds ?? activeAccounts.map((account) => account.id),
        },
      };
    }),
  addAccount: async ({ name, type, currency, initialBalance, excludeFromTotal }) => {
    const state = get();
    const value = name.trim();
    if (!value) {
      return;
    }

    const normalizedCurrency = (currency || state.profile.currency || "USD").trim().toUpperCase();
    const parsedInitial = Number.isFinite(initialBalance)
      ? Number(initialBalance)
      : Number(initialBalance ?? 0);
    const normalizedInitial = Number.isFinite(parsedInitial)
      ? Math.round(parsedInitial * 100) / 100
      : 0;

    const nextAccount: Account = {
      id: generateId("account"),
      name: value,
      type,
      initialBalance: normalizedInitial,
      balance: normalizedInitial,
      currency: normalizedCurrency,
      excludeFromTotal: Boolean(excludeFromTotal),
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    await saveAccount(nextAccount);

    const initialTransaction = createInitialBalanceTransaction(nextAccount);
    if (initialTransaction) {
      await saveTransaction(initialTransaction);
    }

    set((current) => {
      const nextAccounts = [...current.accounts, nextAccount];
      const nextTransactions = initialTransaction
        ? [initialTransaction, ...current.transactions]
        : current.transactions;
      return applyAccountBalanceUpdate(
        { ...current, accounts: nextAccounts },
        nextTransactions,
      );
    });
  },
  updateAccount: async (id, updates) => {
    const existing = get().accounts.find((account) => account.id === id);
    if (!existing) {
      return;
    }

    const next: Account = { ...existing };
    let changed = false;

    if (updates.name !== undefined) {
      const value = updates.name.trim();
      if (value && value !== existing.name) {
        next.name = value;
        changed = true;
      }
    }

    if (updates.type !== undefined && updates.type !== existing.type) {
      next.type = updates.type;
      changed = true;
    }

    if (updates.currency !== undefined) {
      const value = updates.currency.trim().toUpperCase();
      if (value && value !== existing.currency) {
        next.currency = value;
        changed = true;
      }
    }

    if (updates.initialBalance !== undefined) {
      const normalized = Math.round(updates.initialBalance * 100) / 100;
      if (!Number.isNaN(normalized) && normalized !== existing.initialBalance) {
        next.initialBalance = normalized;
        next.balance = normalized;
        changed = true;
      }
    }

    if (updates.excludeFromTotal !== undefined && updates.excludeFromTotal !== existing.excludeFromTotal) {
      next.excludeFromTotal = updates.excludeFromTotal;
      changed = true;
    }

    if (updates.isArchived !== undefined && updates.isArchived !== existing.isArchived) {
      next.isArchived = updates.isArchived;
      changed = true;
    }

    if (!changed) {
      return;
    }

    await saveAccount(next);

    set((state) => {
      const nextAccounts = state.accounts.map((account) => (account.id === id ? next : account));
      return {
        accounts: recalculateAccountBalances(nextAccounts, state.transactions, state.profile.currency),
      };
    });
  },
  archiveAccount: async (id, archived = true) => {
    await get().updateAccount(id, { isArchived: archived });
  },
  addCategory: async (category) => {
    const value = category.name.trim();
    if (!value) {
      return;
    }

    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const id = `cat-${slug}-${category.type}`;

    const existingCategories = get().preferences.categories;
    const normalizedValue = value.toLowerCase();

    const hasDuplicate = existingCategories.some(
      (existing) =>
        existing.type === category.type && existing.name.trim().toLowerCase() === normalizedValue,
    );

    const hasSlugConflict = existingCategories.some((existing) => existing.id === id);

    if (hasDuplicate || hasSlugConflict) {
      return;
    }

    const activeAccounts = get().accounts.filter((account) => !account.isArchived);
    const entry: Category = {
      id,
      name: value,
      type: category.type as CategoryType,
      icon: category.icon ?? "pricetag",
      parentCategoryId: category.parentCategoryId ?? null,
      activeAccountIds: category.activeAccountIds ?? activeAccounts.map((account) => account.id),
    };

    await saveCategory(entry);

    set((state) => ({
      preferences: {
        ...state.preferences,
        categories: [...state.preferences.categories, entry],
      },
    }));
  },
  updateCategory: async (id, updates) => {
    const existing = get().preferences.categories.find((category) => category.id === id);
    if (!existing) {
      return;
    }

    const activeAccounts = get().accounts.filter((account) => !account.isArchived);
    const normalizedName = updates.name?.trim();
    const normalizedActiveAccounts =
      updates.activeAccountIds !== undefined
        ? updates.activeAccountIds
        : existing.activeAccountIds ?? activeAccounts.map((account) => account.id);

    const next: Category = {
      ...existing,
      ...updates,
      name: normalizedName ?? existing.name,
      parentCategoryId:
        updates.parentCategoryId === undefined ? existing.parentCategoryId ?? null : updates.parentCategoryId,
      icon: updates.icon ?? existing.icon ?? "pricetag",
      activeAccountIds: normalizedActiveAccounts,
    };

    await saveCategory(next);

    set((state) => ({
      preferences: {
        ...state.preferences,
        categories: state.preferences.categories.map((category) => (category.id === id ? next : category)),
      },
    }));
  },
  loadMockData: async () => {
    const state = get();
    const mockData = generateAllMockData(state.profile.currency);

    // Save all mock data to database
    for (const account of mockData.accounts) {
      await saveAccount(account);
    }

    for (const category of mockData.customCategories) {
      await saveCategory(category);
    }

    for (const transaction of mockData.transactions) {
      await saveTransaction(transaction);
    }

    for (const recurring of mockData.recurringTransactions) {
      await saveRecurringTransaction(recurring);
    }

    for (const goal of mockData.budgetGoals) {
      await saveBudgetGoal(goal);
    }

    // Reload state from database
    await get().hydrateFromDatabase();
  },
  clearAllDataAndReload: async () => {
    await clearAllData();
    await get().hydrateFromDatabase();
  },
}));

export const selectActiveAccounts = (state: FinanceState) =>
  state.accounts.filter((account) => !account.isArchived);

export const selectAccountById = (accountId: string) => (state: FinanceState) =>
  state.accounts.find((account) => account.id === accountId);

export type {
  Account,
  AccountType,
  BudgetGoal,
  Category,
  Preferences,
  Profile,
  RecurringTransaction,
  ThemeMode,
  Transaction,
  TransactionType,
} from "./types";
export { DEFAULT_ACCOUNT_ID, DEFAULT_CATEGORIES } from "./types";
