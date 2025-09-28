import { create } from "zustand";

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  date: string; // ISO string
}

interface Profile {
  name: string;
  currency: string;
}

interface FinanceState {
  profile: Profile;
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  updateProfile: (payload: Partial<Profile>) => void;
}

const now = new Date();

const daysAgo = (amount: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - amount);
  return date.toISOString();
};

const seedTransactions: Transaction[] = [
  {
    id: "t-1",
    amount: 38,
    note: "Neighborhood coffee catch-up",
    type: "expense",
    category: "Food",
    date: daysAgo(0),
  },
  {
    id: "t-2",
    amount: 120,
    note: "Weekly groceries restock",
    type: "expense",
    category: "Groceries",
    date: daysAgo(1),
  },
  {
    id: "t-3",
    amount: 450,
    note: "UX consultation session",
    type: "income",
    category: "Side Hustle",
    date: daysAgo(1),
  },
  {
    id: "t-4",
    amount: 68,
    note: "Night ramen with friends",
    type: "expense",
    category: "Food",
    date: daysAgo(2),
  },
  {
    id: "t-5",
    amount: 2450,
    note: "Freelance design retainer",
    type: "income",
    category: "Work",
    date: daysAgo(3),
  },
  {
    id: "t-6",
    amount: 52,
    note: "Studio supplies restock",
    type: "expense",
    category: "Creativity",
    date: daysAgo(4),
  },
  {
    id: "t-7",
    amount: 180,
    note: "Dance event tickets",
    type: "expense",
    category: "Lifestyle",
    date: daysAgo(5),
  },
  {
    id: "t-8",
    amount: 3200,
    note: "Product design salary",
    type: "income",
    category: "Salary",
    date: daysAgo(6),
  },
  {
    id: "t-9",
    amount: 42,
    note: "Morning coffee run",
    type: "expense",
    category: "Food",
    date: daysAgo(7),
  },
  {
    id: "t-10",
    amount: 92,
    note: "Climbing gym membership",
    type: "expense",
    category: "Fitness",
    date: daysAgo(8),
  },
  {
    id: "t-11",
    amount: 520,
    note: "Sold old camera lens",
    type: "income",
    category: "Resale",
    date: daysAgo(9),
  },
  {
    id: "t-12",
    amount: 140,
    note: "Dinner date night",
    type: "expense",
    category: "Dining",
    date: daysAgo(11),
  },
  {
    id: "t-13",
    amount: 310,
    note: "Remote workshop facilitation",
    type: "income",
    category: "Consulting",
    date: daysAgo(13),
  },
  {
    id: "t-14",
    amount: 64,
    note: "Co-working day pass",
    type: "expense",
    category: "Work",
    date: daysAgo(14),
  },
  {
    id: "t-15",
    amount: 215,
    note: "Quarterly insurance premium",
    type: "expense",
    category: "Bills",
    date: daysAgo(17),
  },
  {
    id: "t-16",
    amount: 285,
    note: "E-commerce payout",
    type: "income",
    category: "Side Hustle",
    date: daysAgo(18),
  },
  {
    id: "t-17",
    amount: 75,
    note: "Trailhead brunch",
    type: "expense",
    category: "Food",
    date: daysAgo(20),
  },
  {
    id: "t-18",
    amount: 128,
    note: "Household essentials restock",
    type: "expense",
    category: "Home",
    date: daysAgo(23),
  },
  {
    id: "t-19",
    amount: 60,
    note: "Streaming gear rental",
    type: "expense",
    category: "Gear",
    date: daysAgo(26),
  },
  {
    id: "t-20",
    amount: 3200,
    note: "Product design salary",
    type: "income",
    category: "Salary",
    date: daysAgo(34),
  },
  {
    id: "t-21",
    amount: 275,
    note: "Client milestone bonus",
    type: "income",
    category: "Work",
    date: daysAgo(37),
  },
  {
    id: "t-22",
    amount: 88,
    note: "Weekend hike supplies",
    type: "expense",
    category: "Outdoors",
    date: daysAgo(39),
  },
  {
    id: "t-23",
    amount: 145,
    note: "Monthly groceries",
    type: "expense",
    category: "Groceries",
    date: daysAgo(43),
  },
  {
    id: "t-24",
    amount: 310,
    note: "Sold illustration prints",
    type: "income",
    category: "Creative Sales",
    date: daysAgo(46),
  },
  {
    id: "t-25",
    amount: 95,
    note: "Team lunch meetup",
    type: "expense",
    category: "Food",
    date: daysAgo(49),
  },
  {
    id: "t-26",
    amount: 180,
    note: "Photography gear upgrade",
    type: "expense",
    category: "Gear",
    date: daysAgo(52),
  },
  {
    id: "t-27",
    amount: 260,
    note: "UX mentoring session",
    type: "income",
    category: "Consulting",
    date: daysAgo(55),
  },
  {
    id: "t-28",
    amount: 72,
    note: "Monthly transit pass",
    type: "expense",
    category: "Transport",
    date: daysAgo(58),
  },
];

let uid = seedTransactions.length + 1;

export const useFinanceStore = create<FinanceState>((set) => ({
  profile: {
    name: "Alicia Jeanelly",
    currency: "USD",
  },
  transactions: seedTransactions,
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [
        {
          id: `t-${uid++}`,
          ...transaction,
        },
        ...state.transactions,
      ],
    })),
  updateProfile: (payload) =>
    set((state) => ({
      profile: {
        ...state.profile,
        ...payload,
      },
    })),
}));
