export type TransactionType = "income" | "expense" | "transfer";

export type CategoryType = "expense" | "income" | "debt";

export type DateFormat = "dd/mm/yyyy" | "mm/dd/yyyy";

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
  currency?: string;
  participants?: string[];
  location?: string;
  photos?: string[];
  excludeFromReports?: boolean;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon?: string | null;
  parentCategoryId?: string | null;
  activeAccountIds?: string[] | null;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food-expense", name: "Food", type: "expense", icon: "restaurant" },
  {
    id: "cat-groceries-expense",
    name: "Groceries",
    type: "expense",
    icon: "cart",
    parentCategoryId: "cat-food-expense",
  },
  {
    id: "cat-dining-expense",
    name: "Dining",
    type: "expense",
    icon: "fast-food",
    parentCategoryId: "cat-food-expense",
  },
  { id: "cat-lifestyle-expense", name: "Lifestyle", type: "expense", icon: "sparkles" },
  {
    id: "cat-fitness-expense",
    name: "Fitness",
    type: "expense",
    icon: "barbell",
    parentCategoryId: "cat-lifestyle-expense",
  },
  {
    id: "cat-entertainment-expense",
    name: "Entertainment",
    type: "expense",
    icon: "film",
    parentCategoryId: "cat-lifestyle-expense",
  },
  { id: "cat-travel-expense", name: "Travel", type: "expense", icon: "airplane" },
  {
    id: "cat-transport-expense",
    name: "Transport",
    type: "expense",
    icon: "car",
    parentCategoryId: "cat-travel-expense",
  },
  { id: "cat-home-expense", name: "Home", type: "expense", icon: "home" },
  {
    id: "cat-bills-expense",
    name: "Bills",
    type: "expense",
    icon: "file-tray-full",
    parentCategoryId: "cat-home-expense",
  },
  {
    id: "cat-utilities-expense",
    name: "Utilities",
    type: "expense",
    icon: "flash",
    parentCategoryId: "cat-home-expense",
  },
  {
    id: "cat-rent-expense",
    name: "Rent",
    type: "expense",
    icon: "business",
    parentCategoryId: "cat-home-expense",
  },
  { id: "cat-gear-expense", name: "Gear", type: "expense", icon: "hardware-chip" },
  { id: "cat-creativity-expense", name: "Creativity", type: "expense", icon: "color-palette" },
  { id: "cat-outdoors-expense", name: "Outdoors", type: "expense", icon: "leaf" },
  { id: "cat-work-expense", name: "Work Expenses", type: "expense", icon: "briefcase" },
  { id: "cat-pets-expense", name: "Pets", type: "expense", icon: "paw" },
  { id: "cat-family-expense", name: "Family", type: "expense", icon: "people" },
  { id: "cat-health-expense", name: "Health", type: "expense", icon: "medkit" },
  { id: "cat-education-expense", name: "Education", type: "expense", icon: "school" },
  { id: "cat-side-hustle-income", name: "Side Hustle", type: "income", icon: "rocket" },
  { id: "cat-client-work-income", name: "Client Work", type: "income", icon: "briefcase-outline" },
  { id: "cat-salary-income", name: "Salary", type: "income", icon: "cash" },
  { id: "cat-consulting-income", name: "Consulting", type: "income", icon: "chatbubbles" },
  { id: "cat-resale-income", name: "Resale", type: "income", icon: "swap-horizontal" },
  { id: "cat-creative-sales-income", name: "Creative Sales", type: "income", icon: "brush" },
  { id: "cat-investing-income", name: "Investing", type: "income", icon: "trending-up" },
  { id: "cat-bonus-income", name: "Bonus", type: "income", icon: "gift" },
  { id: "cat-dividends-income", name: "Dividends", type: "income", icon: "pie-chart" },
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
  category: string;
  accountId: string;
  isRepeating: boolean;
  createdAt: string;
  currentSpending?: number;
  progress?: number;
}

export interface Profile {
  name: string;
  currency: string;
  dateFormat: DateFormat;
  timezone: string;
}

export interface Preferences {
  themeMode: ThemeMode;
  categories: Category[];
  dateFormat: DateFormat;
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
