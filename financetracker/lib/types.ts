export type TransactionType = "income" | "expense" | "transfer";

export type AccountType = "cash" | "bank" | "card" | "investment";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  initialBalance: number;
  currency: string;
  excludeFromTotal?: boolean;
  isArchived?: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  date: string;
  accountId: string;
  toAccountId?: string | null;
  participants?: string[];
  location?: string;
  photos?: string[];
  excludeFromReports?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food-expense", name: "Food", type: "expense" },
  { id: "cat-groceries-expense", name: "Groceries", type: "expense" },
  { id: "cat-dining-expense", name: "Dining", type: "expense" },
  { id: "cat-lifestyle-expense", name: "Lifestyle", type: "expense" },
  { id: "cat-fitness-expense", name: "Fitness", type: "expense" },
  { id: "cat-travel-expense", name: "Travel", type: "expense" },
  { id: "cat-transport-expense", name: "Transport", type: "expense" },
  { id: "cat-home-expense", name: "Home", type: "expense" },
  { id: "cat-bills-expense", name: "Bills", type: "expense" },
  { id: "cat-gear-expense", name: "Gear", type: "expense" },
  { id: "cat-creativity-expense", name: "Creativity", type: "expense" },
  { id: "cat-outdoors-expense", name: "Outdoors", type: "expense" },
  { id: "cat-work-expense", name: "Work Expenses", type: "expense" },
  { id: "cat-entertainment-expense", name: "Entertainment", type: "expense" },
  { id: "cat-pets-expense", name: "Pets", type: "expense" },
  { id: "cat-family-expense", name: "Family", type: "expense" },
  { id: "cat-health-expense", name: "Health", type: "expense" },
  { id: "cat-education-expense", name: "Education", type: "expense" },
  { id: "cat-utilities-expense", name: "Utilities", type: "expense" },
  { id: "cat-rent-expense", name: "Rent", type: "expense" },
  { id: "cat-side-hustle-income", name: "Side Hustle", type: "income" },
  { id: "cat-client-work-income", name: "Client Work", type: "income" },
  { id: "cat-salary-income", name: "Salary", type: "income" },
  { id: "cat-consulting-income", name: "Consulting", type: "income" },
  { id: "cat-resale-income", name: "Resale", type: "income" },
  { id: "cat-creative-sales-income", name: "Creative Sales", type: "income" },
  { id: "cat-investing-income", name: "Investing", type: "income" },
  { id: "cat-bonus-income", name: "Bonus", type: "income" },
  { id: "cat-dividends-income", name: "Dividends", type: "income" },
];

export const DEFAULT_ACCOUNT_ID = "account-main";

export type ThemeMode = "light" | "dark";

export interface RecurringTransaction {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  accountId: string;
  toAccountId?: string | null;
  frequency: "weekly" | "biweekly" | "monthly";
  nextOccurrence: string;
  isActive: boolean;
}

export interface BudgetGoal {
  id: string;
  name: string;
  target: number;
  period: "week" | "month";
  category?: string | null;
}

export interface Profile {
  name: string;
  currency: string;
}

export interface Preferences {
  themeMode: ThemeMode;
  categories: Category[];
}

export const createDefaultAccount = (currency: string): Account => ({
  id: DEFAULT_ACCOUNT_ID,
  name: "Everyday account",
  type: "bank",
  balance: 0,
  initialBalance: 0,
  currency,
  excludeFromTotal: false,
  isArchived: false,
  createdAt: new Date().toISOString(),
});
