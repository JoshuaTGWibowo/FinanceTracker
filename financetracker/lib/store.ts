import { create } from "zustand";

import {
  type Account,
  type AccountType,
  type BudgetGoal,
  type Category,
  type CategoryType,
  type DateFormat,
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
  loadExchangeRates,
  saveAccount,
  saveBudgetGoal,
  saveCategory,
  saveDateFormat,
  saveExchangeRates,
  saveProfile,
  saveRecurringTransaction,
  saveThemeMode,
  saveTransaction,
} from "./storage/sqlite";
import { generateAllMockData } from "./mockData";
import { triggerSync } from "./sync-service";
import { awardTransactionPoints, updateDailyStreak, getLeaderboardStats } from "./points-service";
import { checkAllBudgets } from "./budget-tracking";
import { checkAndUpdateAllMissions } from "./mission-service";
import { refreshExpiredMissions } from "./mission-refresh";
import {
  convertCurrency,
  fetchExchangeRates,
  shouldAutoSyncRates,
} from "./currency";

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
  // Smart features
  stickyDate: string | null;
  stickyDateLastUsed: number | null;
  setStickyDate: (date: string | null) => void;
  getSuggestedCategoryForAmount: (amount: number, type: TransactionType) => string | null;
  // Exchange rates
  exchangeRates: Record<string, number>;
  exchangeRatesBaseCurrency: string;
  exchangeRatesLastUpdated: string | null;
  exchangeRatesSyncing: boolean;
  syncExchangeRates: () => Promise<boolean>;
  convertToBaseCurrency: (amount: number, fromCurrency: string) => number;
  getTransactionAmountInBaseCurrency: (transaction: Transaction) => number;
  getTotalBalanceInBaseCurrency: () => number;
  getAccountBalanceInBaseCurrency: (accountId: string) => number;
  hasForeignCurrencyAccounts: () => boolean;
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
  setDateFormat: (format: DateFormat) => Promise<void>;
  setTimezone: (timezone: string) => Promise<void>;
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
  ) => Promise<string | undefined>;
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

  const ensureAccount = (accountId?: string | null): Account | undefined => {
    if (!accountId) {
      return undefined;
    }

    let account: Account | undefined = base.find((item) => item.id === accountId);
    if (!account) {
      account = extras.find((item) => item.id === accountId);
    }

    if (!account) {
      const newAccount: Account = {
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
      extras.push(newAccount);
      return newAccount;
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
    dateFormat: "dd/mm/yyyy",
    timezone: "Australia/Melbourne",
  },
  preferences: {
    themeMode: "dark",
    dateFormat: "dd/mm/yyyy",
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
  stickyDate: null,
  stickyDateLastUsed: null,
  setStickyDate: (date) => set({ stickyDate: date, stickyDateLastUsed: date ? Date.now() : null }),
  // Exchange rates state
  exchangeRates: {},
  exchangeRatesBaseCurrency: "USD",
  exchangeRatesLastUpdated: null,
  exchangeRatesSyncing: false,
  syncExchangeRates: async () => {
    const baseCurrency = get().profile.currency || "USD";
    console.log(`[Currency] Fetching exchange rates for base: ${baseCurrency}`);
    set({ exchangeRatesSyncing: true });
    
    try {
      const result = await fetchExchangeRates(baseCurrency);
      if (result) {
        console.log(`[Currency] Received ${Object.keys(result.rates).length} exchange rates`);
        await saveExchangeRates(baseCurrency, result.rates, result.timestamp);
        set({
          exchangeRates: result.rates,
          exchangeRatesBaseCurrency: baseCurrency,
          exchangeRatesLastUpdated: result.timestamp,
          exchangeRatesSyncing: false,
        });
        // Log some sample rates for debugging
        if (__DEV__) {
          const sampleCurrencies = ["USD", "EUR", "IDR", "JPY"].filter(c => c !== baseCurrency);
          const sampleRates = sampleCurrencies
            .map(c => result.rates[c] ? `${c}=${result.rates[c].toFixed(4)}` : null)
            .filter(Boolean)
            .join(", ");
          console.log(`[Currency] Sample rates (1 ${baseCurrency} = X): ${sampleRates}`);
        }
        return true;
      }
      console.warn(`[Currency] No rates returned from API`);
      set({ exchangeRatesSyncing: false });
      return false;
    } catch (error) {
      console.error("[Currency] Failed to sync exchange rates:", error);
      set({ exchangeRatesSyncing: false });
      return false;
    }
  },
  convertToBaseCurrency: (amount, fromCurrency) => {
    const { exchangeRates, profile } = get();
    const baseCurrency = profile.currency || "USD";
    
    if (fromCurrency === baseCurrency || Object.keys(exchangeRates).length === 0) {
      return amount;
    }
    
    return convertCurrency(amount, fromCurrency, baseCurrency, exchangeRates, baseCurrency);
  },
  getTransactionAmountInBaseCurrency: (transaction) => {
    const { accounts, exchangeRates, exchangeRatesBaseCurrency, profile } = get();
    const baseCurrency = profile.currency || "USD";
    
    // First check if transaction has its own currency
    let transactionCurrency = transaction.currency;
    
    // If not, get it from the account
    if (!transactionCurrency && transaction.accountId) {
      const account = accounts.find((a) => a.id === transaction.accountId);
      transactionCurrency = account?.currency;
    }
    
    // Default to base currency if still undefined
    if (!transactionCurrency) {
      transactionCurrency = baseCurrency;
    }
    
    // If same currency, return as-is
    if (transactionCurrency === baseCurrency) {
      return transaction.amount;
    }
    
    // Convert to base currency
    if (Object.keys(exchangeRates).length > 0) {
      // Verify rates are for current base currency
      if (exchangeRatesBaseCurrency !== baseCurrency) {
        if (__DEV__) {
          console.warn(
            `[Currency] Rates base mismatch: stored=${exchangeRatesBaseCurrency}, current=${baseCurrency}. ` +
            `Returning original amount. Rates should be synced.`
          );
        }
        return transaction.amount;
      }
      
      const converted = convertCurrency(
        transaction.amount,
        transactionCurrency,
        baseCurrency,
        exchangeRates,
        baseCurrency,
      );
      
      if (__DEV__ && Math.abs(converted - transaction.amount) > 0.01) {
        console.log(
          `[Currency] Converting ${transaction.amount} ${transactionCurrency} -> ${converted.toFixed(2)} ${baseCurrency}`
        );
      }
      
      return converted;
    }
    
    // No rates available, return as-is
    if (__DEV__) {
      console.warn(`[Currency] No exchange rates available for ${transactionCurrency} -> ${baseCurrency}`);
    }
    return transaction.amount;
  },
  getTotalBalanceInBaseCurrency: () => {
    const { accounts, exchangeRates, profile } = get();
    const baseCurrency = profile.currency || "USD";
    
    return accounts
      .filter((acc) => !acc.isArchived && !acc.excludeFromTotal)
      .reduce((total, acc) => {
        const accountCurrency = acc.currency || baseCurrency;
        if (accountCurrency === baseCurrency) {
          return total + acc.balance;
        }
        // Convert to base currency
        if (Object.keys(exchangeRates).length > 0) {
          const converted = convertCurrency(
            acc.balance,
            accountCurrency,
            baseCurrency,
            exchangeRates,
            baseCurrency,
          );
          return total + converted;
        }
        // No rates available, skip foreign accounts
        return total;
      }, 0);
  },
  getAccountBalanceInBaseCurrency: (accountId: string) => {
    const { accounts, exchangeRates, profile } = get();
    const baseCurrency = profile.currency || "USD";
    const account = accounts.find((acc) => acc.id === accountId);
    
    if (!account) {
      return 0;
    }
    
    const accountCurrency = account.currency || baseCurrency;
    if (accountCurrency === baseCurrency) {
      return account.balance;
    }
    
    // Convert to base currency
    if (Object.keys(exchangeRates).length > 0) {
      return convertCurrency(
        account.balance,
        accountCurrency,
        baseCurrency,
        exchangeRates,
        baseCurrency,
      );
    }
    
    // No rates available, return raw balance
    return account.balance;
  },
  hasForeignCurrencyAccounts: () => {
    const { accounts, profile } = get();
    const baseCurrency = profile.currency || "USD";
    
    return accounts
      .filter((acc) => !acc.isArchived && !acc.excludeFromTotal)
      .some((acc) => (acc.currency || baseCurrency) !== baseCurrency);
  },
  getSuggestedCategoryForAmount: (amount, type) => {
    const transactions = get().transactions;
    // Round amount to 2 decimals for comparison
    const roundedAmount = Math.round(amount * 100) / 100;
    
    // Find all transactions with this exact amount and type
    const matchingTransactions = transactions.filter(
      (t) => Math.round(t.amount * 100) / 100 === roundedAmount && t.type === type
    );
    
    if (matchingTransactions.length < 2) {
      return null; // Need at least 2 transactions to suggest
    }
    
    // Count category occurrences
    const categoryCounts = new Map<string, number>();
    matchingTransactions.forEach((t) => {
      const count = categoryCounts.get(t.category) || 0;
      categoryCounts.set(t.category, count + 1);
    });
    
    // Find most common category
    let maxCount = 0;
    let suggestedCategory: string | null = null;
    
    categoryCounts.forEach((count, category) => {
      if (count > maxCount && count >= 2) { // At least 2 occurrences
        maxCount = count;
        suggestedCategory = category;
      }
    });
    
    return suggestedCategory;
  },
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

      // Load cached exchange rates
      const cachedRates = await loadExchangeRates();
      const exchangeRatesState = cachedRates
        ? {
            exchangeRates: cachedRates.rates,
            exchangeRatesBaseCurrency: cachedRates.baseCurrency,
            exchangeRatesLastUpdated: cachedRates.lastUpdated,
          }
        : {};

      set({
        profile: data.profile,
        preferences: data.preferences,
        accounts: normalizedAccounts,
        transactions: transactionsWithInitialBalance,
        recurringTransactions: data.recurringTransactions,
        budgetGoals: data.budgetGoals,
        ...exchangeRatesState,
        isHydrated: true,
        isHydrating: false,
      });

      // Silently auto-sync exchange rates if stale (>7 days old)
      if (shouldAutoSyncRates(cachedRates?.lastUpdated ?? null)) {
        get().syncExchangeRates().catch(() => {
          // Silently fail, fall back to cached rates
        });
      }
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
      createdAt: new Date().toISOString(),
    };

    await saveTransaction(payload);

    set((state) => {
      const nextTransactions = [payload, ...state.transactions];
      return applyAccountBalanceUpdate(state, nextTransactions);
    });

    // Award points for logging transaction
    awardTransactionPoints(payload).then(async (result) => {
      if (result.success && result.pointsAwarded) {
        console.log(`[Points] +${result.pointsAwarded} pts for transaction`);
        if (result.leveledUp) {
          console.log('[Points] 🎉 Level up!');
          // TODO: Trigger level-up modal via event emitter or global state
        }
        // Force UI update by triggering state change
        const currentState = get();
        set({ transactions: [...currentState.transactions] });
      }
    }).catch(err => console.error('[Points] Error awarding points:', err));

    // Update daily streak
    updateDailyStreak().catch(err => console.error('[Points] Error updating streak:', err));

    // Check budget completion and award points
    // IMPORTANT: Use get() to get the UPDATED state with the new transaction
    const updatedState = get();
    checkAllBudgets(
      updatedState.budgetGoals, 
      updatedState.transactions, 
      updatedState.preferences.categories,
      get().getTransactionAmountInBaseCurrency
    ).catch(err => console.error('[Points] Error checking budgets:', err));

    // Check and update mission progress with the NEW transaction included
    (async () => {
      try {
        // Get fresh state to ensure new transaction is included
        const currentTransactions = get().transactions;
        console.log(`[Mission] Checking missions with ${currentTransactions.length} transactions`);
        
        const statsResult = await getLeaderboardStats();
        if (statsResult.success && statsResult.stats) {
          const result = await checkAndUpdateAllMissions(
            currentTransactions, // Use fresh transactions with new one included
            statsResult.stats.streakDays
          );
          if (result.success) {
            if (result.completedMissions && result.completedMissions.length > 0) {
              console.log(`[Mission] 🎉 Completed ${result.completedMissions.length} mission(s)!`);
            }
            // Always trigger a state update to refresh mission UI with new progress
            const freshState = get();
            set({ transactions: [...freshState.transactions] });
            console.log('[Mission] Triggered UI refresh');
          }
        }
      } catch (err) {
        console.error('[Mission] Error in mission checking:', err);
      }
    })();

    // Trigger auto-sync after adding transaction
    triggerSync(updatedState.transactions, updatedState.budgetGoals);
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
    const currencyChanged = payload.currency && payload.currency !== current.currency;
    const newCurrency = payload.currency;
    
    const nextProfile: Profile = {
      ...current,
      ...payload,
    };

    await saveProfile(nextProfile);

    set({ profile: nextProfile });
    
    // Re-sync exchange rates if the base currency changed
    if (currencyChanged && newCurrency) {
      console.log(`[Currency] Base currency changed to ${newCurrency}, syncing exchange rates...`);
      
      // Also update the default "Everyday Account" to use the new base currency
      const defaultAccount = get().accounts.find((account) => account.id === DEFAULT_ACCOUNT_ID);
      if (defaultAccount) {
        console.log(`[Currency] Updating Everyday Account currency to ${newCurrency}...`);
        await get().updateAccount(DEFAULT_ACCOUNT_ID, { currency: newCurrency });
      }
      
      // Wait for rates to sync before returning
      const syncResult = await get().syncExchangeRates();
      
      if (syncResult) {
        console.log(`[Currency] Exchange rates synced successfully for ${newCurrency}`);
      } else {
        console.warn(`[Currency] Failed to sync exchange rates for ${newCurrency}`);
      }
    }
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
  setDateFormat: async (format) => {
    await saveDateFormat(format);
    set((state) => ({
      profile: {
        ...state.profile,
        dateFormat: format,
      },
      preferences: {
        ...state.preferences,
        dateFormat: format,
      },
    }));
  },
  setTimezone: async (timezone) => {
    set((state) => ({
      profile: { ...state.profile, timezone },
    }));

    const state = get();
    await saveProfile(state.profile);
    
    // Trigger mission refresh with new timezone
    console.log(`[Timezone] Changing timezone to ${timezone}, refreshing missions...`);
    try {
      const result = await refreshExpiredMissions(timezone);
      if (result.success) {
        if (result.refreshedCount && result.refreshedCount > 0) {
          console.log(`[Timezone] 🌏 Refreshed ${result.refreshedCount} mission(s) for new timezone`);
        } else {
          console.log('[Timezone] No expired missions to refresh');
        }
        // Force UI refresh
        set((state) => ({ profile: { ...state.profile, timezone } }));
      } else {
        console.error('[Timezone] Refresh failed:', result.error);
      }
    } catch (err) {
      console.error('[Timezone] Error refreshing missions:', err);
    }
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
      return undefined;
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

    return nextAccount.id;
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
