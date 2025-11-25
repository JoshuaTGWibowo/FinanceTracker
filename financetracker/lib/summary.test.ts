import assert from "node:assert/strict";
import { describe, it } from "node:test";
import dayjs from "dayjs";

import { calculateMonthlySummary } from "./summary";
import { Account, Transaction } from "./types";

const baseAccounts: Account[] = [
  {
    id: "a1",
    name: "Checking",
    type: "bank",
    balance: 0,
    initialBalance: 100,
    currency: "USD",
    excludeFromTotal: false,
    isArchived: false,
    createdAt: "2024-01-01",
  },
  {
    id: "a2",
    name: "Savings",
    type: "bank",
    balance: 0,
    initialBalance: 50,
    currency: "USD",
    excludeFromTotal: false,
    isArchived: false,
    createdAt: "2024-01-01",
  },
];

const commonTransactions: Transaction[] = [
  {
    id: "t-pre-a1",
    amount: 20,
    note: "Pre-month expense",
    type: "expense",
    category: "Bills",
    date: "2024-12-31",
    accountId: "a1",
  },
  {
    id: "t-month-a1",
    amount: 100,
    note: "Month income",
    type: "income",
    category: "Salary",
    date: "2025-01-05",
    accountId: "a1",
  },
  {
    id: "t-month-a2",
    amount: 30,
    note: "Month expense",
    type: "expense",
    category: "Groceries",
    date: "2025-01-10",
    accountId: "a2",
  },
  {
    id: "t-post-a1",
    amount: 10,
    note: "Future income",
    type: "income",
    category: "Interest",
    date: "2025-02-01",
    accountId: "a1",
  },
];

const startOfMonth = dayjs("2025-01-01").startOf("month");
const endOfMonth = dayjs("2025-01-01").endOf("month");

const visibleAccountIds = ["a1", "a2"];

describe("calculateMonthlySummary", () => {
  it("seeds opening balance with all visible account initial balances and pre-month deltas", () => {
    const summary = calculateMonthlySummary({
      accounts: baseAccounts,
      transactions: commonTransactions,
      visibleAccountIds,
      selectedAccountId: null,
      startOfMonth,
      endOfMonth,
    });

    assert.equal(summary.openingBalance, 130);
    assert.equal(summary.monthNet, 70);
    assert.equal(summary.postMonthNet, 10);
    assert.equal(summary.endingBalance, 210);
  });

  it("uses the selected account's initial balance when filtered", () => {
    const account2Transactions: Transaction[] = [
      {
        id: "t-pre-a2",
        amount: 5,
        note: "Savings fee",
        type: "expense",
        category: "Fees",
        date: "2024-12-15",
        accountId: "a2",
      },
      commonTransactions[2],
    ];

    const summary = calculateMonthlySummary({
      accounts: baseAccounts,
      transactions: account2Transactions,
      visibleAccountIds,
      selectedAccountId: "a2",
      startOfMonth,
      endOfMonth,
    });

    assert.equal(summary.openingBalance, 45);
    assert.equal(summary.monthNet, -30);
    assert.equal(summary.postMonthNet, 0);
    assert.equal(summary.endingBalance, 15);
  });
});
