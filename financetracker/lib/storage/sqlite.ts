import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import {
  type Account,
  type BudgetGoal,
  type Category,
  DEFAULT_CATEGORIES,
  type Preferences,
  type Profile,
  type RecurringTransaction,
  type ThemeMode,
  type Transaction,
  createDefaultAccount,
} from "../types";

interface FinanceStatePayload {
  profile: Profile;
  preferences: Preferences;
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  budgetGoals: BudgetGoal[];
}

const DB_NAME = "finance-tracker.db";

let databasePromise: Promise<SQLiteDatabase> | null = null;
let schemaReadyPromise: Promise<void> | null = null;

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DB_NAME);
  }

  const db = await databasePromise;
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema(db);
  }

  await schemaReadyPromise;
  return db;
};

const ensureColumnExists = async (
  db: SQLiteDatabase,
  table: string,
  column: string,
  type: string,
  defaultClause?: string,
) => {
  const existingColumns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const hasColumn = existingColumns.some((item) => item.name === column);
  if (!hasColumn) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} ${defaultClause ?? ""};`);
  }
};

const ensureSchema = async (db: SQLiteDatabase) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      currency TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY NOT NULL,
      themeMode TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      parentCategoryId TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      initialBalance REAL NOT NULL,
      currency TEXT NOT NULL,
      excludeFromTotal INTEGER NOT NULL DEFAULT 0,
      isArchived INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      note TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      accountId TEXT NOT NULL,
      toAccountId TEXT,
      participants TEXT,
      location TEXT,
      photos TEXT,
      excludeFromReports INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      note TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      accountId TEXT NOT NULL,
      toAccountId TEXT,
      frequency TEXT NOT NULL,
      nextOccurrence TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS budget_goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      period TEXT NOT NULL,
      category TEXT
    );
  `);

  await ensureColumnExists(db, "categories", "icon", "TEXT");
  await ensureColumnExists(db, "categories", "parentCategoryId", "TEXT");

  const profileCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM profile");
  if (!profileCount?.count) {
    await db.runAsync("INSERT INTO profile (id, name, currency) VALUES (1, ?, ?)", [
      "Alicia Jeanelly",
      "USD",
    ]);
  }

  const preferencesCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM preferences",
  );
  if (!preferencesCount?.count) {
    await db.runAsync("INSERT INTO preferences (id, themeMode) VALUES (1, ?)", ["dark"]);
  }

  const categoryCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories",
  );
  if (!categoryCount?.count) {
    for (const category of DEFAULT_CATEGORIES) {
      await db.runAsync(
        "INSERT INTO categories (id, name, type, icon, parentCategoryId) VALUES (?, ?, ?, ?, ?)",
        [category.id, category.name, category.type, category.icon ?? null, category.parentCategoryId ?? null],
      );
    }
  }

  const accountCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM accounts",
  );
  if (!accountCount?.count) {
    const defaultAccount = createDefaultAccount("USD");
    await db.runAsync(
      `INSERT INTO accounts (
        id,
        name,
        type,
        initialBalance,
        currency,
        excludeFromTotal,
        isArchived,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultAccount.id,
        defaultAccount.name,
        defaultAccount.type,
        defaultAccount.initialBalance,
        defaultAccount.currency,
        defaultAccount.excludeFromTotal ? 1 : 0,
        defaultAccount.isArchived ? 1 : 0,
        defaultAccount.createdAt,
      ],
    );
  }
};

interface TransactionRow {
  id: string;
  amount: number;
  note: string;
  type: string;
  category: string;
  date: string;
  accountId: string;
  toAccountId: string | null;
  participants: string | null;
  location: string | null;
  photos: string | null;
  excludeFromReports: number;
}

interface AccountRow {
  id: string;
  name: string;
  type: string;
  initialBalance: number;
  currency: string;
  excludeFromTotal: number;
  isArchived: number;
  createdAt: string;
}

interface RecurringRow {
  id: string;
  amount: number;
  note: string;
  type: string;
  category: string | null;
  accountId: string;
  toAccountId: string | null;
  frequency: string;
  nextOccurrence: string;
  isActive: number;
}

interface BudgetGoalRow {
  id: string;
  name: string;
  target: number;
  period: string;
  category: string | null;
}

export const fetchFinanceState = async (): Promise<FinanceStatePayload> => {
  const db = await getDatabase();

  const profileRow = await db.getFirstAsync<Profile>("SELECT name, currency FROM profile LIMIT 1");
  const profile: Profile = profileRow ?? { name: "Alicia Jeanelly", currency: "USD" };

  const preferenceRow = await db.getFirstAsync<{ themeMode: ThemeMode }>(
    "SELECT themeMode FROM preferences LIMIT 1",
  );

  const categories = await db.getAllAsync<Category>(
    "SELECT id, name, type, icon, parentCategoryId FROM categories ORDER BY rowid",
  );

  const accountRows = await db.getAllAsync<AccountRow>(
    "SELECT id, name, type, initialBalance, currency, excludeFromTotal, isArchived, createdAt FROM accounts ORDER BY createdAt",
  );

  const transactionRows = await db.getAllAsync<TransactionRow>(
    "SELECT * FROM transactions ORDER BY date DESC, rowid DESC",
  );

  const recurringRows = await db.getAllAsync<RecurringRow>(
    "SELECT * FROM recurring_transactions ORDER BY nextOccurrence",
  );

  const budgetRows = await db.getAllAsync<BudgetGoalRow>(
    "SELECT * FROM budget_goals ORDER BY rowid",
  );

  const preferences: Preferences = {
    themeMode: preferenceRow?.themeMode ?? "dark",
    categories: categories.length ? categories : [...DEFAULT_CATEGORIES],
  };

  const accounts = accountRows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as Account["type"],
    initialBalance: row.initialBalance,
    balance: row.initialBalance,
    currency: row.currency,
    excludeFromTotal: Boolean(row.excludeFromTotal),
    isArchived: Boolean(row.isArchived),
    createdAt: row.createdAt,
  }));

  const transactions = transactionRows.map((row) => ({
    id: row.id,
    amount: row.amount,
    note: row.note,
    type: row.type as Transaction["type"],
    category: row.category,
    date: row.date,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    participants: row.participants ? (JSON.parse(row.participants) as string[]) : [],
    location: row.location ?? undefined,
    photos: row.photos ? (JSON.parse(row.photos) as string[]) : [],
    excludeFromReports: Boolean(row.excludeFromReports),
  }));

  const recurringTransactions = recurringRows.map((row) => ({
    id: row.id,
    amount: row.amount,
    note: row.note,
    type: row.type as RecurringTransaction["type"],
    category: row.category ?? "",
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    frequency: row.frequency as RecurringTransaction["frequency"],
    nextOccurrence: row.nextOccurrence,
    isActive: Boolean(row.isActive),
  }));

  const budgetGoals = budgetRows.map((row) => ({
    id: row.id,
    name: row.name,
    target: row.target,
    period: row.period as BudgetGoal["period"],
    category: row.category,
  }));

  return {
    profile,
    preferences,
    accounts: accounts.length ? accounts : [createDefaultAccount(profile.currency)],
    transactions,
    recurringTransactions,
    budgetGoals,
  };
};

const serializeArray = (values?: string[]) => JSON.stringify(values ?? []);

export const saveTransaction = async (transaction: Transaction) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO transactions (
      id,
      amount,
      note,
      type,
      category,
      date,
      accountId,
      toAccountId,
      participants,
      location,
      photos,
      excludeFromReports
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      amount=excluded.amount,
      note=excluded.note,
      type=excluded.type,
      category=excluded.category,
      date=excluded.date,
      accountId=excluded.accountId,
      toAccountId=excluded.toAccountId,
      participants=excluded.participants,
      location=excluded.location,
      photos=excluded.photos,
      excludeFromReports=excluded.excludeFromReports`,
    [
      transaction.id,
      transaction.amount,
      transaction.note,
      transaction.type,
      transaction.category,
      transaction.date,
      transaction.accountId,
      transaction.toAccountId ?? null,
      serializeArray(transaction.participants),
      transaction.location ?? null,
      serializeArray(transaction.photos),
      transaction.excludeFromReports ? 1 : 0,
    ],
  );
};

export const deleteTransaction = async (id: string) => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
};

export const saveRecurringTransaction = async (transaction: RecurringTransaction) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO recurring_transactions (
      id,
      amount,
      note,
      type,
      category,
      accountId,
      toAccountId,
      frequency,
      nextOccurrence,
      isActive
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      amount=excluded.amount,
      note=excluded.note,
      type=excluded.type,
      category=excluded.category,
      accountId=excluded.accountId,
      toAccountId=excluded.toAccountId,
      frequency=excluded.frequency,
      nextOccurrence=excluded.nextOccurrence,
      isActive=excluded.isActive`,
    [
      transaction.id,
      transaction.amount,
      transaction.note,
      transaction.type,
      transaction.category,
      transaction.accountId,
      transaction.toAccountId ?? null,
      transaction.frequency,
      transaction.nextOccurrence,
      transaction.isActive ? 1 : 0,
    ],
  );
};

export const saveBudgetGoal = async (goal: BudgetGoal) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO budget_goals (id, name, target, period, category)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       target=excluded.target,
       period=excluded.period,
       category=excluded.category`,
    [goal.id, goal.name, goal.target, goal.period, goal.category ?? null],
  );
};

export const deleteBudgetGoal = async (id: string) => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM budget_goals WHERE id = ?", [id]);
};

export const saveProfile = async (profile: Profile) => {
  const db = await getDatabase();
  await db.runAsync("UPDATE profile SET name = ?, currency = ? WHERE id = 1", [
    profile.name,
    profile.currency,
  ]);
};

export const saveThemeMode = async (mode: ThemeMode) => {
  const db = await getDatabase();
  await db.runAsync("UPDATE preferences SET themeMode = ? WHERE id = 1", [mode]);
};

export const saveCategory = async (category: Category) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO categories (id, name, type, icon, parentCategoryId)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       type=excluded.type,
       icon=excluded.icon,
       parentCategoryId=excluded.parentCategoryId`,
    [category.id, category.name, category.type, category.icon ?? null, category.parentCategoryId ?? null],
  );
};

export const saveAccount = async (account: Account) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO accounts (
      id,
      name,
      type,
      initialBalance,
      currency,
      excludeFromTotal,
      isArchived,
      createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      type=excluded.type,
      initialBalance=excluded.initialBalance,
      currency=excluded.currency,
      excludeFromTotal=excluded.excludeFromTotal,
      isArchived=excluded.isArchived,
      createdAt=excluded.createdAt`,
    [
      account.id,
      account.name,
      account.type,
      account.initialBalance,
      account.currency,
      account.excludeFromTotal ? 1 : 0,
      account.isArchived ? 1 : 0,
      account.createdAt,
    ],
  );
};

/**
 * Clear all data from the database (for mock data toggle)
 */
export const clearAllData = async () => {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM recurring_transactions;
    DELETE FROM budget_goals;
    DELETE FROM accounts;
    DELETE FROM categories;
  `);

  // Re-insert default categories
  for (const category of DEFAULT_CATEGORIES) {
    await db.runAsync(
      "INSERT INTO categories (id, name, type, icon, parentCategoryId) VALUES (?, ?, ?, ?, ?)",
      [category.id, category.name, category.type, category.icon ?? null, category.parentCategoryId ?? null],
    );
  }

  // Re-insert default account
  const profile = await db.getFirstAsync<Profile>("SELECT name, currency FROM profile LIMIT 1");
  const defaultAccount = createDefaultAccount(profile?.currency || "USD");
  await db.runAsync(
    `INSERT INTO accounts (
      id,
      name,
      type,
      initialBalance,
      currency,
      excludeFromTotal,
      isArchived,
      createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      defaultAccount.id,
      defaultAccount.name,
      defaultAccount.type,
      defaultAccount.initialBalance,
      defaultAccount.currency,
      defaultAccount.excludeFromTotal ? 1 : 0,
      defaultAccount.isArchived ? 1 : 0,
      defaultAccount.createdAt,
    ],
  );
};
