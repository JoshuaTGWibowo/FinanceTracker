import type {
    Account,
    BudgetGoal,
    Category,
    RecurringTransaction,
    Transaction,
} from "./types";

const generateId = (prefix: string) =>
    `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;

/**
 * Generate a date string for the past N days
 */
const daysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

/**
 * Generate a date string for N days in the future
 */
const daysFromNow = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

/**
 * Generate mock accounts with different types and balances
 */
export const generateMockAccounts = (currency: string): Account[] => {
    const now = new Date().toISOString();

    return [
        {
            id: "account-checking",
            name: "Main Checking",
            type: "bank",
            balance: 5420.50,
            initialBalance: 5000,
            currency,
            excludeFromTotal: false,
            isArchived: false,
            createdAt: daysAgo(180),
        },
        {
            id: "account-savings",
            name: "Emergency Fund",
            type: "bank",
            balance: 12500,
            initialBalance: 10000,
            currency,
            excludeFromTotal: false,
            isArchived: false,
            createdAt: daysAgo(365),
        },
        {
            id: "account-credit",
            name: "Visa Credit Card",
            type: "card",
            balance: -850.75,
            initialBalance: 0,
            currency,
            excludeFromTotal: false,
            isArchived: false,
            createdAt: daysAgo(90),
        },
        {
            id: "account-investment",
            name: "Investment Portfolio",
            type: "investment",
            balance: 25000,
            initialBalance: 20000,
            currency,
            excludeFromTotal: false,
            isArchived: false,
            createdAt: daysAgo(730),
        },
        {
            id: "account-cash",
            name: "Cash Wallet",
            type: "cash",
            balance: 240,
            initialBalance: 200,
            currency,
            excludeFromTotal: false,
            isArchived: false,
            createdAt: daysAgo(30),
        },
        {
            id: "account-vacation",
            name: "Vacation Savings",
            type: "bank",
            balance: 3200,
            initialBalance: 2000,
            currency,
            excludeFromTotal: true,
            isArchived: false,
            createdAt: daysAgo(150),
        },
    ];
};

/**
 * Generate comprehensive mock transactions across various categories and time periods
 */
export const generateMockTransactions = (accounts: Account[]): Transaction[] => {
    const checkingId = accounts.find(a => a.type === "bank")?.id || "account-checking";
    const creditId = accounts.find(a => a.type === "card")?.id || "account-credit";
    const cashId = accounts.find(a => a.type === "cash")?.id || "account-cash";
    const savingsId = accounts.find(a => a.name.includes("Emergency") || a.name.includes("Savings"))?.id || "account-savings";
    const investmentId = accounts.find(a => a.type === "investment")?.id || "account-investment";

    const mockTransactions: Omit<Transaction, "id">[] = [
        // Recent income transactions
        { amount: 4500, note: "Monthly Salary", type: "income", category: "Salary", date: daysAgo(1), accountId: checkingId },
        { amount: 850, note: "Freelance project", type: "income", category: "Side Hustle", date: daysAgo(3), accountId: checkingId },
        { amount: 120.50, note: "Design consultation", type: "income", category: "Consulting", date: daysAgo(5), accountId: checkingId },

        // Food & Dining - Last 7 days
        { amount: 45.80, note: "Whole Foods groceries", type: "expense", category: "Groceries", date: daysAgo(1), accountId: creditId },
        { amount: 28.50, note: "Coffee and breakfast", type: "expense", category: "Dining", date: daysAgo(2), accountId: checkingId },
        { amount: 65.20, note: "Dinner at Italian restaurant", type: "expense", category: "Dining", date: daysAgo(3), accountId: creditId },
        { amount: 92.35, note: "Weekly grocery shopping", type: "expense", category: "Groceries", date: daysAgo(4), accountId: creditId },
        { amount: 12.50, note: "Lunch - Thai food", type: "expense", category: "Food", date: daysAgo(5), accountId: cashId },
        { amount: 38.90, note: "Brunch with friends", type: "expense", category: "Dining", date: daysAgo(6), accountId: checkingId, participants: ["Sarah", "Mike"] },
        { amount: 15.75, note: "Coffee shop", type: "expense", category: "Dining", date: daysAgo(7), accountId: cashId },

        // Transport - Last 14 days
        { amount: 65, note: "Gas fill-up", type: "expense", category: "Transport", date: daysAgo(2), accountId: creditId },
        { amount: 8.50, note: "Bus pass", type: "expense", category: "Transport", date: daysAgo(5), accountId: cashId },
        { amount: 22, note: "Uber ride", type: "expense", category: "Transport", date: daysAgo(8), accountId: checkingId },
        { amount: 45, note: "Gas", type: "expense", category: "Transport", date: daysAgo(12), accountId: creditId },

        // Bills & Utilities - Last 30 days
        { amount: 1450, note: "Monthly rent", type: "expense", category: "Rent", date: daysAgo(1), accountId: checkingId },
        { amount: 85.50, note: "Electric bill", type: "expense", category: "Utilities", date: daysAgo(5), accountId: checkingId },
        { amount: 55, note: "Internet bill", type: "expense", category: "Bills", date: daysAgo(7), accountId: checkingId },
        { amount: 125, note: "Phone bill", type: "expense", category: "Bills", date: daysAgo(10), accountId: creditId },
        { amount: 42, note: "Water bill", type: "expense", category: "Utilities", date: daysAgo(12), accountId: checkingId },

        // Entertainment & Lifestyle
        { amount: 45, note: "Movie tickets", type: "expense", category: "Entertainment", date: daysAgo(3), accountId: checkingId, participants: ["Alex"] },
        { amount: 89.99, note: "New running shoes", type: "expense", category: "Fitness", date: daysAgo(6), accountId: creditId },
        { amount: 12.99, note: "Netflix subscription", type: "expense", category: "Entertainment", date: daysAgo(8), accountId: creditId },
        { amount: 35, note: "Gym membership", type: "expense", category: "Fitness", date: daysAgo(10), accountId: checkingId },
        { amount: 78.50, note: "Concert tickets", type: "expense", category: "Entertainment", date: daysAgo(15), accountId: creditId },
        { amount: 125, note: "Spa & massage", type: "expense", category: "Lifestyle", date: daysAgo(18), accountId: creditId },

        // Shopping & Gear
        { amount: 156.75, note: "New laptop bag", type: "expense", category: "Gear", date: daysAgo(4), accountId: creditId },
        { amount: 45.20, note: "Art supplies", type: "expense", category: "Creativity", date: daysAgo(9), accountId: checkingId },
        { amount: 89, note: "Birthday gift for mom", type: "expense", category: "Family", date: daysAgo(11), accountId: checkingId },
        { amount: 32.50, note: "Book purchase", type: "expense", category: "Education", date: daysAgo(14), accountId: checkingId },

        // Health & Wellness
        { amount: 120, note: "Doctor visit copay", type: "expense", category: "Health", date: daysAgo(7), accountId: checkingId },
        { amount: 45.80, note: "Pharmacy - prescriptions", type: "expense", category: "Health", date: daysAgo(9), accountId: creditId },
        { amount: 85, note: "Dental cleaning", type: "expense", category: "Health", date: daysAgo(20), accountId: checkingId },

        // Travel
        { amount: 450, note: "Flight to Seattle", type: "expense", category: "Travel", date: daysAgo(22), accountId: creditId },
        { amount: 180, note: "Hotel - 2 nights", type: "expense", category: "Travel", date: daysAgo(21), accountId: creditId },
        { amount: 65.30, note: "Travel expenses", type: "expense", category: "Travel", date: daysAgo(20), accountId: cashId },

        // Home & Pets
        { amount: 78.90, note: "Home decor items", type: "expense", category: "Home", date: daysAgo(13), accountId: creditId },
        { amount: 52.40, note: "Dog food and treats", type: "expense", category: "Pets", date: daysAgo(16), accountId: checkingId },
        { amount: 125, note: "Vet checkup", type: "expense", category: "Pets", date: daysAgo(25), accountId: creditId },

        // Work expenses
        { amount: 45, note: "Coffee with client", type: "expense", category: "Work Expenses", date: daysAgo(8), accountId: checkingId },
        { amount: 28.50, note: "Office supplies", type: "expense", category: "Work Expenses", date: daysAgo(17), accountId: checkingId },

        // Transfers
        { amount: 500, note: "Transfer to savings", type: "transfer", category: "Transfer", date: daysAgo(2), accountId: checkingId, toAccountId: savingsId },
        { amount: 200, note: "Transfer to investment", type: "transfer", category: "Transfer", date: daysAgo(15), accountId: checkingId, toAccountId: investmentId },

        // Older transactions (30-60 days)
        { amount: 4500, note: "Monthly Salary", type: "income", category: "Salary", date: daysAgo(32), accountId: checkingId },
        { amount: 1450, note: "Monthly rent", type: "expense", category: "Rent", date: daysAgo(32), accountId: checkingId },
        { amount: 235.80, note: "Costco shopping", type: "expense", category: "Groceries", date: daysAgo(35), accountId: creditId },
        { amount: 89.50, note: "Date night dinner", type: "expense", category: "Dining", date: daysAgo(38), accountId: creditId },
        { amount: 750, note: "Bonus payment", type: "income", category: "Bonus", date: daysAgo(40), accountId: checkingId },
        { amount: 325, note: "New monitor", type: "expense", category: "Gear", date: daysAgo(42), accountId: creditId },
        { amount: 180, note: "Yoga workshop", type: "expense", category: "Fitness", date: daysAgo(45), accountId: checkingId },
        { amount: 95.40, note: "Grocery shopping", type: "expense", category: "Groceries", date: daysAgo(48), accountId: creditId },
        { amount: 52, note: "Gas", type: "expense", category: "Transport", date: daysAgo(50), accountId: creditId },
        { amount: 42.80, note: "Streaming services", type: "expense", category: "Entertainment", date: daysAgo(55), accountId: creditId },
        { amount: 165, note: "Pet insurance", type: "expense", category: "Pets", date: daysAgo(58), accountId: checkingId },

        // Even older transactions (60-90 days)
        { amount: 4500, note: "Monthly Salary", type: "income", category: "Salary", date: daysAgo(63), accountId: checkingId },
        { amount: 1450, note: "Monthly rent", type: "expense", category: "Rent", date: daysAgo(63), accountId: checkingId },
        { amount: 500, note: "Transfer to savings", type: "transfer", category: "Transfer", date: daysAgo(65), accountId: checkingId, toAccountId: savingsId },
        { amount: 850, note: "Car insurance", type: "expense", category: "Bills", date: daysAgo(68), accountId: checkingId },
        { amount: 125.50, note: "Groceries", type: "expense", category: "Groceries", date: daysAgo(70), accountId: creditId },
        { amount: 78.90, note: "Restaurant", type: "expense", category: "Dining", date: daysAgo(72), accountId: creditId },
        { amount: 300, note: "Freelance payment", type: "income", category: "Side Hustle", date: daysAgo(75), accountId: checkingId },
        { amount: 95, note: "Haircut and styling", type: "expense", category: "Lifestyle", date: daysAgo(78), accountId: checkingId },
        { amount: 210, note: "Online courses", type: "expense", category: "Education", date: daysAgo(80), accountId: creditId },
        { amount: 68.40, note: "Groceries", type: "expense", category: "Groceries", date: daysAgo(85), accountId: creditId },
    ];

    // Convert to full transactions with IDs
    return mockTransactions.map(t => ({
        ...t,
        id: generateId("t"),
    }));
};

/**
 * Generate mock recurring transactions
 */
export const generateMockRecurringTransactions = (accounts: Account[]): RecurringTransaction[] => {
    const checkingId = accounts.find(a => a.type === "bank")?.id || "account-checking";
    const creditId = accounts.find(a => a.type === "card")?.id || "account-credit";

    return [
        {
            id: generateId("r"),
            amount: 4500,
            note: "Monthly Salary",
            type: "income" as const,
            category: "Salary",
            accountId: checkingId,
            frequency: "monthly" as const,
            nextOccurrence: daysFromNow(28),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 1450,
            note: "Rent payment",
            type: "expense" as const,
            category: "Rent",
            accountId: checkingId,
            frequency: "monthly" as const,
            nextOccurrence: daysFromNow(29),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 12.99,
            note: "Netflix subscription",
            type: "expense" as const,
            category: "Entertainment",
            accountId: creditId,
            frequency: "monthly" as const,
            nextOccurrence: daysFromNow(22),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 9.99,
            note: "Spotify Premium",
            type: "expense" as const,
            category: "Entertainment",
            accountId: creditId,
            frequency: "monthly" as const,
            nextOccurrence: daysFromNow(15),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 35,
            note: "Gym membership",
            type: "expense" as const,
            category: "Fitness",
            accountId: checkingId,
            frequency: "monthly" as const,
            nextOccurrence: daysFromNow(20),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 150,
            note: "Grocery budget",
            type: "expense" as const,
            category: "Groceries",
            accountId: checkingId,
            frequency: "weekly" as const,
            nextOccurrence: daysFromNow(4),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 250,
            note: "Weekly freelance client",
            type: "income" as const,
            category: "Side Hustle",
            accountId: checkingId,
            frequency: "weekly" as const,
            nextOccurrence: daysFromNow(7),
            isActive: true,
        },
        {
            id: generateId("r"),
            amount: 55,
            note: "Internet bill",
            type: "expense" as const,
            category: "Bills",
            accountId: checkingId,
            frequency: "monthly" as const,
            nextOccurrence: daysFromNow(23),
            isActive: true,
        },
    ];
};

/**
 * Generate mock budget goals
 */
export const generateMockBudgetGoals = (): BudgetGoal[] => {
    return [
        {
            id: generateId("g"),
            name: "Monthly Savings Goal",
            target: 1000,
            period: "month" as const,
            category: null,
        },
        {
            id: generateId("g"),
            name: "Grocery Budget",
            target: 600,
            period: "month" as const,
            category: "Groceries",
        },
        {
            id: generateId("g"),
            name: "Dining Out Limit",
            target: 300,
            period: "month" as const,
            category: "Dining",
        },
        {
            id: generateId("g"),
            name: "Entertainment Budget",
            target: 200,
            period: "month" as const,
            category: "Entertainment",
        },
        {
            id: generateId("g"),
            name: "Weekly Spending Target",
            target: 250,
            period: "week" as const,
            category: null,
        },
        {
            id: generateId("g"),
            name: "Transport Budget",
            target: 400,
            period: "month" as const,
            category: "Transport",
        },
    ];
};

/**
 * Generate mock custom categories
 */
export const generateMockCategories = (): Category[] => {
    return [
        { id: "cat-subscriptions-expense", name: "Subscriptions", type: "expense" },
        { id: "cat-gifts-expense", name: "Gifts", type: "expense" },
        { id: "cat-books-expense", name: "Books", type: "expense" },
        { id: "cat-freelance-income", name: "Freelance", type: "income" },
        { id: "cat-refunds-income", name: "Refunds", type: "income" },
    ];
};

/**
 * Generate all mock data at once
 */
export const generateAllMockData = (currency: string) => {
    const accounts = generateMockAccounts(currency);
    const transactions = generateMockTransactions(accounts);
    const recurringTransactions = generateMockRecurringTransactions(accounts);
    const budgetGoals = generateMockBudgetGoals();
    const customCategories = generateMockCategories();

    return {
        accounts,
        transactions,
        recurringTransactions,
        budgetGoals,
        customCategories,
    };
};
