/**
 * Currency Helpers - Reactive hooks and utilities for multi-currency support.
 *
 * This module provides centralized currency conversion utilities that work
 * seamlessly with the Zustand store and React components.
 *
 * USAGE:
 * - useConvertedAmount(transaction) - Get a single transaction's amount in base currency
 * - useConvertedTransactions(transactions) - Get all transactions with converted amounts
 * - useCurrencyConverter() - Get the converter function for use in callbacks
 */

import { useMemo, useCallback } from "react";

import { useFinanceStore } from "./store";
import { convertCurrency } from "./currency";
import type { Transaction } from "./types";

/**
 * A transaction with an additional convertedAmount field.
 * The original amount is preserved for display purposes.
 */
export interface TransactionWithConversion extends Transaction {
  /** The amount converted to the user's base currency */
  convertedAmount: number;
  /** The original currency of this transaction */
  originalCurrency: string;
  /** Whether the amount was converted (false if same currency as base) */
  wasConverted: boolean;
}

/**
 * Hook to get a single transaction's amount converted to the base currency.
 * Re-renders when exchange rates or base currency changes.
 */
export const useConvertedAmount = (transaction: Transaction): number => {
  const accounts = useFinanceStore((state) => state.accounts);
  const exchangeRates = useFinanceStore((state) => state.exchangeRates);
  const baseCurrency = useFinanceStore((state) => state.profile.currency || "USD");

  return useMemo(() => {
    return convertTransactionAmount(
      transaction,
      accounts,
      exchangeRates,
      baseCurrency
    );
  }, [transaction, accounts, exchangeRates, baseCurrency]);
};

/**
 * Hook to get multiple transactions with their amounts converted to base currency.
 * Returns transactions augmented with conversion metadata.
 */
export const useConvertedTransactions = (
  transactions: Transaction[]
): TransactionWithConversion[] => {
  const accounts = useFinanceStore((state) => state.accounts);
  const exchangeRates = useFinanceStore((state) => state.exchangeRates);
  const baseCurrency = useFinanceStore((state) => state.profile.currency || "USD");

  return useMemo(() => {
    return transactions.map((transaction) => {
      const originalCurrency = getTransactionCurrency(transaction, accounts, baseCurrency);
      const convertedAmount = convertTransactionAmount(
        transaction,
        accounts,
        exchangeRates,
        baseCurrency
      );

      return {
        ...transaction,
        convertedAmount,
        originalCurrency,
        wasConverted: originalCurrency !== baseCurrency,
      };
    });
  }, [transactions, accounts, exchangeRates, baseCurrency]);
};

/**
 * Hook to get a currency converter function.
 * Useful for callbacks and memoized computations.
 */
export const useCurrencyConverter = () => {
  const accounts = useFinanceStore((state) => state.accounts);
  const exchangeRates = useFinanceStore((state) => state.exchangeRates);
  const baseCurrency = useFinanceStore((state) => state.profile.currency || "USD");

  return useCallback(
    (transaction: Transaction): number => {
      return convertTransactionAmount(
        transaction,
        accounts,
        exchangeRates,
        baseCurrency
      );
    },
    [accounts, exchangeRates, baseCurrency]
  );
};

/**
 * Hook to get transaction metadata including converted amount.
 * Useful for displaying both original and converted amounts.
 */
export const useTransactionWithConversion = (
  transaction: Transaction
): TransactionWithConversion => {
  const accounts = useFinanceStore((state) => state.accounts);
  const exchangeRates = useFinanceStore((state) => state.exchangeRates);
  const baseCurrency = useFinanceStore((state) => state.profile.currency || "USD");

  return useMemo(() => {
    const originalCurrency = getTransactionCurrency(transaction, accounts, baseCurrency);
    const convertedAmount = convertTransactionAmount(
      transaction,
      accounts,
      exchangeRates,
      baseCurrency
    );

    return {
      ...transaction,
      convertedAmount,
      originalCurrency,
      wasConverted: originalCurrency !== baseCurrency,
    };
  }, [transaction, accounts, exchangeRates, baseCurrency]);
};

// ============================================================================
// Pure Functions (Non-React)
// ============================================================================

/**
 * Get the currency code for a transaction.
 * Priority: transaction.currency > account.currency > baseCurrency
 */
export const getTransactionCurrency = (
  transaction: Transaction,
  accounts: { id: string; currency?: string }[],
  baseCurrency: string
): string => {
  // 1. Check if transaction has its own currency
  if (transaction.currency) {
    return transaction.currency;
  }

  // 2. Get currency from the account
  if (transaction.accountId) {
    const account = accounts.find((a) => a.id === transaction.accountId);
    if (account?.currency) {
      return account.currency;
    }
  }

  // 3. Default to base currency
  return baseCurrency;
};

/**
 * Convert a transaction amount to the base currency.
 * Returns the original amount if no conversion is needed or rates unavailable.
 */
export const convertTransactionAmount = (
  transaction: Transaction,
  accounts: { id: string; currency?: string }[],
  exchangeRates: Record<string, number>,
  baseCurrency: string
): number => {
  const transactionCurrency = getTransactionCurrency(transaction, accounts, baseCurrency);

  // Same currency - no conversion needed
  if (transactionCurrency === baseCurrency) {
    return transaction.amount;
  }

  // No rates available - return original
  if (!exchangeRates || Object.keys(exchangeRates).length === 0) {
    console.warn(
      `[Currency] No exchange rates available for conversion ${transactionCurrency} -> ${baseCurrency}`
    );
    return transaction.amount;
  }

  // Convert using the rates
  const converted = convertCurrency(
    transaction.amount,
    transactionCurrency,
    baseCurrency,
    exchangeRates,
    baseCurrency // The rates are relative to baseCurrency
  );

  return converted;
};

/**
 * Sum transaction amounts with currency conversion.
 * Useful for calculating totals across multiple currencies.
 */
export const sumConvertedAmounts = (
  transactions: Transaction[],
  accounts: { id: string; currency?: string }[],
  exchangeRates: Record<string, number>,
  baseCurrency: string
): number => {
  return transactions.reduce((total, transaction) => {
    const converted = convertTransactionAmount(
      transaction,
      accounts,
      exchangeRates,
      baseCurrency
    );
    return total + converted;
  }, 0);
};

/**
 * Calculate income, expense, and net amounts with conversion.
 */
export const calculateConvertedTotals = (
  transactions: Transaction[],
  accounts: { id: string; currency?: string }[],
  exchangeRates: Record<string, number>,
  baseCurrency: string
): { income: number; expense: number; net: number } => {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    const converted = convertTransactionAmount(
      transaction,
      accounts,
      exchangeRates,
      baseCurrency
    );

    if (transaction.type === "income") {
      income += converted;
    } else if (transaction.type === "expense") {
      expense += converted;
    }
    // Transfers don't affect income/expense totals
  }

  return { income, expense, net: income - expense };
};

/**
 * Group transactions by category and sum converted amounts.
 */
export const sumByCategory = (
  transactions: Transaction[],
  accounts: { id: string; currency?: string }[],
  exchangeRates: Record<string, number>,
  baseCurrency: string
): Map<string, number> => {
  const categoryTotals = new Map<string, number>();

  for (const transaction of transactions) {
    const converted = convertTransactionAmount(
      transaction,
      accounts,
      exchangeRates,
      baseCurrency
    );
    const current = categoryTotals.get(transaction.category) || 0;
    categoryTotals.set(transaction.category, current + converted);
  }

  return categoryTotals;
};
