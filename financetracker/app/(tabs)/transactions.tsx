import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs, { type Dayjs } from "dayjs";

import { useAppTheme } from "../../theme";
import { Transaction, useFinanceStore } from "../../lib/store";
import {
  filterTransactionsByAccount,
  getTransactionDelta,
  getTransactionVisualState,
  type TransactionVisualVariant,
} from "../../lib/transactions";
import { truncateWords } from "../../lib/text";

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) => {
  const maxDigits =
    options?.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : Number.isInteger(value)
        ? 0
        : 2;
  const minDigits =
    options?.minimumFractionDigits !== undefined
      ? options.minimumFractionDigits
      : Number.isInteger(value)
        ? 0
        : Math.min(2, maxDigits);

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    ...options,
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  }).format(value);
};

const parseAmountFilterValue = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const sanitized = value.replace(/[\s']/g, "").replace(/[^0-9,.-]/g, "");
  if (!sanitized) {
    return undefined;
  }

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");
  let normalized = sanitized;

  if (hasComma && hasDot) {
    const lastComma = sanitized.lastIndexOf(",");
    const lastDot = sanitized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    const thousandPattern = new RegExp(`\\${thousandSeparator}`, "g");
    normalized = normalized.replace(thousandPattern, "");
    if (decimalSeparator === ",") {
      normalized = normalized.replace(/,/g, ".");
    }
  } else if (hasComma) {
    const parts = sanitized.split(",");
    const isDecimalCandidate =
      parts.length === 2 && (parts[1].length <= 3 || parts[0].length > 2);
    normalized = isDecimalCandidate ? sanitized.replace(/,/g, ".") : sanitized.replace(/,/g, "");
  } else if (hasDot) {
    const parts = sanitized.split(".");
    const isDecimalCandidate = parts.length === 2 && parts[1].length <= 3;
    normalized = isDecimalCandidate ? sanitized : sanitized.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const formatPercentage = (current: number, previous: number): string => {
  if (previous === 0) return "—";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
};

interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
}

const DEFAULT_PERIOD_START = dayjs("2025-01-01").startOf("month");

const buildMonthlyPeriods = (transactions: Transaction[]): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");

  const baselineMonths: Dayjs[] = [];
  let cursor = DEFAULT_PERIOD_START;
  while (!cursor.isAfter(currentMonth)) {
    baselineMonths.push(cursor);
    cursor = cursor.add(1, "month");
  }

  const extraMonthsMap = new Map<string, Dayjs>();
  transactions.forEach((transaction) => {
    const month = dayjs(transaction.date).startOf("month");
    if (month.isBefore(DEFAULT_PERIOD_START)) {
      const key = month.format("YYYY-MM");
      if (!extraMonthsMap.has(key)) {
        extraMonthsMap.set(key, month);
      }
    }
  });

  const combined = [...extraMonthsMap.values(), ...baselineMonths];
  const uniqueMonths = new Map<string, Dayjs>();
  combined.forEach((month) => {
    const key = month.format("YYYY-MM");
    if (!uniqueMonths.has(key)) {
      uniqueMonths.set(key, month);
    }
  });

  const sorted = Array.from(uniqueMonths.values()).sort(
    (a, b) => a.valueOf() - b.valueOf(),
  );

  return sorted.map((month) => ({
    key: month.format("YYYY-MM"),
    label: month.format("MMM YYYY"),
    range: () => ({
      start: month.startOf("month"),
      end: month.endOf("month"),
    }),
  }));
};

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const logRecurringTransaction = useFinanceStore((state) => state.logRecurringTransaction);
  const accounts = useFinanceStore((state) => state.accounts);
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string | string[] }>();

  const baseCurrency = currency || "USD";

  const periodOptions = useMemo(() => buildMonthlyPeriods(transactions), [transactions]);
  const scrollViewRef = useRef<ScrollView>(null);

  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency,
      ),
    [accounts, baseCurrency],
  );

  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const allAccountsBalance = useMemo(
    () => visibleAccounts.reduce((acc, account) => acc + account.balance, 0),
    [visibleAccounts],
  );
  
  // Default to current month (last item in array)
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const currentMonth = periodOptions[periodOptions.length - 1];
    return currentMonth?.key ?? "";
  });
  
  // Auto-scroll to current month on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);

    return () => clearTimeout(timeout);
  }, []);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryParam) {
      return;
    }

    const rawValues = Array.isArray(categoryParam) ? categoryParam : [categoryParam];
    const sanitized = rawValues
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);

    if (!sanitized.length) {
      return;
    }

    const normalized = Array.from(new Set(sanitized));

    setSelectedCategories((prev) => {
      if (prev.length === normalized.length && prev.every((value, index) => value === normalized[index])) {
        return prev;
      }
      return normalized;
    });
  }, [categoryParam]);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      map.set(account.id, account.name);
    });
    return map;
  }, [accounts]);

  const resolveAccountName = useCallback(
    (accountId?: string | null) => {
      if (!accountId) {
        return "Unassigned account";
      }
      return accountLookup.get(accountId) ?? "Unknown account";
    },
    [accountLookup],
  );

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category],
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDraftSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSelectedCategories([]);
    setStartDate(null);
    setEndDate(null);
  };

  const openSearch = (showFilters = false) => {
    setDraftSearchTerm(searchTerm);
    setFiltersExpanded(showFilters);
    setSearchVisible(true);
  };

  const closeSearch = () => {
    setSearchVisible(false);
    setDraftSearchTerm(searchTerm);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const handleSearchSubmit = (term: string) => {
    const nextTerm = term.trim();
    setSearchTerm(nextTerm);
    setSearchVisible(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; type: string; value?: string }[] = [];
    if (searchTerm) {
      filters.push({ key: `search-${searchTerm}`, label: searchTerm, type: "search" });
    }
    const minAmountValue = parseAmountFilterValue(minAmount);
    if (minAmountValue !== undefined) {
      filters.push({
        key: "min",
        label: `Min ${formatCurrency(minAmountValue, currency || "USD")}`,
        type: "min",
      });
    }
    const maxAmountValue = parseAmountFilterValue(maxAmount);
    if (maxAmountValue !== undefined) {
      filters.push({
        key: "max",
        label: `Max ${formatCurrency(maxAmountValue, currency || "USD")}`,
        type: "max",
      });
    }
    if (startDate) {
      filters.push({ key: "start", label: startDate.format("MMM D"), type: "start" });
    }
    if (endDate) {
      filters.push({ key: "end", label: endDate.format("MMM D"), type: "end" });
    }
    selectedCategories.forEach((category) => {
      filters.push({ key: `cat-${category}`, label: category, type: "category", value: category });
    });
    return filters;
  }, [currency, endDate, maxAmount, minAmount, searchTerm, selectedCategories, startDate]);

  const hasActiveFilters = activeFilters.length > 0;

  const { sections, summary, expenseBreakdown, filteredRecurring } = useMemo(() => {
    const period = periodOptions.find((option) => option.key === selectedPeriod) ?? periodOptions[periodOptions.length - 1];
    const { start, end } = period.range();

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

    const minAmountValue = parseAmountFilterValue(minAmount);
    const maxAmountValue = parseAmountFilterValue(maxAmount);

    const filtered = periodTransactions.filter((transaction) => {
      const date = dayjs(transaction.date);

      // Date range filters
      if (startDate && date.isBefore(startDate)) return false;
      if (endDate && date.isAfter(endDate)) return false;

      // Amount filters
      const amount = transaction.amount;
      if (minAmountValue !== undefined && amount < minAmountValue) return false;
      if (maxAmountValue !== undefined && amount > maxAmountValue) return false;
      
      // Category filter
      if (selectedCategories.length && !selectedCategories.includes(transaction.category)) {
        return false;
      }
      
      // Search filter
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

    // Group by date with daily totals
    const grouped = new Map<
      string,
      {
        transactions: Transaction[];
        dailyIncome: number;
        dailyExpense: number;
        dailyNet: number;
      }
    >();
    filtered
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

    const sectionData = Array.from(grouped.entries()).map(([key, value]) => ({
      title: dayjs(key).format("dddd, MMM D"),
      data: [{ ...value, id: key }],
      dailyIncome: value.dailyIncome,
      dailyExpense: value.dailyExpense,
      dailyNet: value.dailyNet,
    }));

    // Calculate summary
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

    // Calculate balances
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

    // Expense breakdown
    const expenseMap = reportable.reduce((acc, transaction) => {
      if (transaction.type !== "expense") return acc;
      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const breakdown = Array.from(expenseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totals.expense ? Math.round((amount / totals.expense) * 100) : 0,
      }));

    // Recurring transactions
    const recurring = recurringTransactions.filter((item) => {
      const occurrence = dayjs(item.nextOccurrence);
      const matchesAccount =
        !selectedAccountId || item.accountId === selectedAccountId || item.toAccountId === selectedAccountId;
      return matchesAccount && !occurrence.isBefore(start) && !occurrence.isAfter(end);
    });

    return {
      sections: sectionData,
      summary: {
        income: totals.income,
        expense: totals.expense,
        net: netChange,
        openingBalance,
        closingBalance,
        percentageChange: formatPercentage(closingBalance, openingBalance),
      },
      expenseBreakdown: breakdown,
      filteredRecurring: recurring,
    };
  }, [
    endDate,
    maxAmount,
    minAmount,
    periodOptions,
    recurringTransactions,
    searchTerm,
    selectedPeriod,
    selectedCategories,
    selectedAccountId,
    startDate,
    transactions,
    visibleAccountIds,
  ]);

  const closingBalanceDisplay = useMemo(() => {
    const amount = summary.closingBalance;
    const hasCents = !Number.isInteger(Math.round(amount * 100) / 100)
      ? true
      : !Number.isInteger(amount);

    return formatCurrency(amount, currency || "USD", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }, [currency, summary.closingBalance]);

  const balanceFontSize = useMemo(() => {
    const digitCount = closingBalanceDisplay.replace(/[^0-9]/g, "").length;
    if (digitCount <= 6) return 32;
    if (digitCount <= 9) return 28;
    if (digitCount <= 12) return 24;
    return 20;
  }, [closingBalanceDisplay]);

  const totalTransactions = useMemo(() => {
    return sections.reduce((acc, section) => {
      const day = section.data[0];
      return acc + (day?.transactions.length ?? 0);
    }, 0);
  }, [sections]);

  const positiveDayCount = useMemo(
    () => sections.filter((section) => section.dailyNet > 0).length,
    [sections],
  );

  const averageTransactionsPerDay = sections.length
    ? totalTransactions / sections.length
    : 0;

  const positiveDayPercentage = sections.length
    ? Math.round((positiveDayCount / sections.length) * 100)
    : 0;

  const spendingToIncomeRatio = useMemo(() => {
    if (summary.income <= 0) {
      return 0;
    }
    const ratio = Math.round((summary.expense / summary.income) * 100);
    return Math.min(200, Math.max(0, ratio));
  }, [summary.expense, summary.income]);

  const nextRecurring = useMemo(() => {
    if (!filteredRecurring.length) {
      return null;
    }

    return [...filteredRecurring].sort(
      (a, b) => dayjs(a.nextOccurrence).valueOf() - dayjs(b.nextOccurrence).valueOf(),
    )[0];
  }, [filteredRecurring]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Primary Balance Display */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <View>
                  <Text style={styles.balanceLabel}>Current Balance</Text>
                  <Text style={styles.balanceValue(balanceFontSize)}>{closingBalanceDisplay}</Text>
                </View>
                <View style={styles.changeBadge(summary.net)}>
                  <Ionicons
                    name={summary.net >= 0 ? "arrow-up" : "arrow-down"}
                    size={14}
                    color={summary.net >= 0 ? theme.colors.success : theme.colors.danger}
                  />
                  <Text style={styles.changeValue(summary.net)}>
                    {formatCurrency(Math.abs(summary.net), currency || "USD")}
                  </Text>
                  <Text style={styles.changePercent}>
                    {summary.percentageChange}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={styles.metricValue(theme.colors.success)}>
                    {formatCurrency(summary.income, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Expenses</Text>
                  <Text style={styles.metricValue(theme.colors.danger)}>
                    {formatCurrency(summary.expense, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Previous</Text>
                  <Text style={styles.metricValue(theme.colors.text)}>
                    {formatCurrency(summary.openingBalance, currency || "USD")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Period Selector */}
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.periodScroll}
              contentContainerStyle={styles.periodContent}
            >
              {periodOptions.map((option) => {
                const active = option.key === selectedPeriod;
                return (
                  <Pressable
                    key={option.key}
                    style={styles.periodChip(active)}
                    onPress={() => setSelectedPeriod(option.key)}
                  >
                    <Text style={styles.periodText(active)}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Search and Filters */}
            <View style={styles.searchContainer}>
              <Pressable
                style={styles.searchField}
                onPress={() => openSearch(false)}
              >
                <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                <Text style={styles.searchPlaceholder}>
                  {searchTerm || "Search transactions..."}
                </Text>
              </Pressable>
              <Pressable
                style={styles.filterButton(hasActiveFilters)}
                onPress={() => openSearch(true)}
              >
                <Ionicons
                  name="filter"
                  size={18}
                  color={hasActiveFilters ? theme.colors.primary : theme.colors.text}
                />
                {hasActiveFilters && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilters.length}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Active Filters */}
            {hasActiveFilters && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChips}
              >
                {activeFilters.map((filter) => (
                  <View key={filter.key} style={styles.filterChip}>
                    <Text style={styles.filterChipText}>{filter.label}</Text>
                    <Pressable
                      onPress={() => {
                        if (filter.type === "search") setSearchTerm("");
                        else if (filter.type === "min") setMinAmount("");
                        else if (filter.type === "max") setMaxAmount("");
                        else if (filter.type === "start") setStartDate(null);
                        else if (filter.type === "end") setEndDate(null);
                        else if (filter.type === "category" && filter.value) {
                          setSelectedCategories((prev) =>
                            prev.filter((c) => c !== filter.value),
                          );
                        }
                      }}
                      style={styles.filterChipClose}
                    >
                      <Ionicons name="close" size={12} color={theme.colors.background} />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={clearFilters} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear all</Text>
                </Pressable>
              </ScrollView>
            )}

            <View style={styles.insightsGrid}>
              <View style={[styles.insightCard, styles.insightCardWide]}>
                <View style={styles.insightHeader}>
                  <View>
                    <Text style={styles.insightLabel}>Net cashflow</Text>
                    <Text style={styles.insightValue(
                      summary.net >= 0 ? theme.colors.success : theme.colors.danger,
                    )}>
                      {formatCurrency(summary.net, currency || "USD")}
                    </Text>
                  </View>
                  <View style={styles.insightIcon(summary.net >= 0 ? "success" : "danger")}>
                    <Ionicons
                      name={summary.net >= 0 ? "trending-up" : "trending-down"}
                      size={16}
                      color={summary.net >= 0 ? theme.colors.success : theme.colors.danger}
                    />
                  </View>
                </View>
                <Text style={styles.insightSubtext}>
                  {sections.length
                    ? `${positiveDayCount} of ${sections.length} days positive`
                    : "No activity yet"}
                </Text>
                <View style={styles.insightProgress}>
                  <View style={styles.insightProgressFill(positiveDayPercentage)} />
                </View>
              </View>

              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View>
                    <Text style={styles.insightLabel}>Transactions logged</Text>
                    <Text style={styles.insightValue(theme.colors.primary)}>
                      {totalTransactions}
                    </Text>
                  </View>
                  <View style={styles.insightIcon("primary")}>
                    <Ionicons name="receipt-outline" size={16} color={theme.colors.primary} />
                  </View>
                </View>
                <Text style={styles.insightSubtext}>
                  Avg {averageTransactionsPerDay.toFixed(1)} per day
                </Text>
              </View>

              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View>
                    <Text style={styles.insightLabel}>Spending vs income</Text>
                    <Text style={styles.insightValue()}>
                      {summary.income > 0 ? `${spendingToIncomeRatio}%` : "—"}
                    </Text>
                  </View>
                  <View style={styles.insightIcon("muted")}>
                    <Ionicons name="pie-chart-outline" size={16} color={theme.colors.text} />
                  </View>
                </View>
                <View style={styles.ratioBar}>
                  <View style={styles.ratioFill(spendingToIncomeRatio)} />
                </View>
                <Text style={styles.insightSubtext}>
                  {summary.income > 0
                    ? `${formatCurrency(summary.expense, currency || "USD")} spent`
                    : "Log income to compare"}
                </Text>
              </View>

              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View>
                    <Text style={styles.insightLabel}>Recurring this period</Text>
                    <Text style={styles.insightValue(theme.colors.accent)}>
                      {filteredRecurring.length}
                    </Text>
                  </View>
                  <View style={styles.insightIcon("accent")}>
                    <Ionicons name="repeat" size={16} color={theme.colors.accent} />
                  </View>
                </View>
                <Text style={styles.insightSubtext}>
                  {nextRecurring
                    ? `${nextRecurring.category} • ${dayjs(nextRecurring.nextOccurrence).format("MMM D")}`
                    : "All caught up"}
                </Text>
              </View>
            </View>

            <View style={styles.accountSection}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Accounts</Text>
                <Text style={styles.sectionHint}>Tap to focus totals</Text>
              </View>
              <View style={styles.accountGrid}>
                <Pressable
                  onPress={() => setSelectedAccountId(null)}
                  style={styles.accountCard(!selectedAccountId)}
                >
                  <View style={styles.accountAvatar(!selectedAccountId)}>
                    <Ionicons
                      name="grid-outline"
                      size={16}
                      color={!selectedAccountId ? theme.colors.background : theme.colors.text}
                    />
                  </View>
                  <View style={styles.accountDetails}>
                    <Text
                      style={[
                        styles.accountName,
                        !selectedAccountId && styles.accountNameActive,
                      ]}
                    >
                      All accounts
                    </Text>
                    <Text
                      style={[
                        styles.accountBalance,
                        !selectedAccountId && styles.accountBalanceActive,
                      ]}
                    >
                      {formatCurrency(allAccountsBalance, baseCurrency)}
                    </Text>
                  </View>
                </Pressable>

                {accounts.map((account) => {
                  const active = selectedAccountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => setSelectedAccountId(account.id)}
                      style={[styles.accountCard(active), account.isArchived && styles.accountCardArchived]}
                    >
                      <View style={styles.accountAvatar(active)}>
                        <Ionicons
                          name={account.isArchived ? "archive-outline" : "wallet-outline"}
                          size={16}
                          color={active ? theme.colors.background : theme.colors.text}
                        />
                      </View>
                      <View style={styles.accountDetails}>
                        <Text
                          style={[styles.accountName, active && styles.accountNameActive]}
                          numberOfLines={1}
                        >
                          {account.name}
                        </Text>
                        <Text
                          style={[styles.accountBalance, active && styles.accountBalanceActive]}
                          numberOfLines={1}
                        >
                          {formatCurrency(account.balance, account.currency || baseCurrency)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Expense Breakdown */}
            {expenseBreakdown.length > 0 && (
              <Pressable
                style={styles.breakdownCard}
                onPress={() => setCategoriesExpanded(!categoriesExpanded)}
              >
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>Spending focus</Text>
                    <Text style={styles.sectionHint}>
                      Tap to {categoriesExpanded ? "collapse" : "expand"}
                    </Text>
                  </View>
                  <View style={styles.breakdownIcon}>
                    <Ionicons
                      name={categoriesExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={theme.colors.primary}
                    />
                  </View>
                </View>
                <View style={styles.breakdownPreview}>
                  {(categoriesExpanded ? expenseBreakdown : expenseBreakdown.slice(0, 3)).map(
                    (item) => (
                      <View key={item.category} style={styles.breakdownPill}>
                        <View style={styles.breakdownInfo}>
                          <Text style={styles.breakdownCategory}>{item.category}</Text>
                          <Text style={styles.breakdownAmount}>
                            {formatCurrency(item.amount, currency || "USD")} • {item.percentage}%
                          </Text>
                        </View>
                        <View style={styles.breakdownBar}>
                          <View style={styles.breakdownBarFill(item.percentage)} />
                        </View>
                      </View>
                    ),
                  )}
                </View>
              </Pressable>
            )}

            {/* Recurring Transactions */}
            {filteredRecurring.length > 0 && (
              <View style={styles.recurringSection}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeading}>Upcoming recurring</Text>
                  <Text style={styles.sectionHint}>{filteredRecurring.length} scheduled</Text>
                </View>
                {filteredRecurring.map((item) => (
                  <View key={item.id} style={styles.recurringCard}>
                    <View style={styles.recurringBadge}>
                      <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.recurringDetails}>
                      <Text style={styles.recurringCategory}>{item.category}</Text>
                      {item.note ? (
                        <Text style={styles.recurringNote} numberOfLines={2}>
                          {truncateWords(item.note, 10)}
                        </Text>
                      ) : null}
                      <Text style={styles.recurringMeta}>
                        {dayjs(item.nextOccurrence).format("MMM D")} • {item.frequency}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => logRecurringTransaction(item.id)}
                      style={styles.logButton}
                    >
                      <Text style={styles.logButtonText}>Log</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {sections.length > 0 && (
              <Text style={styles.transactionsTitle}>Recent Transactions</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>
              {hasActiveFilters 
                ? "Try adjusting your filters" 
                : "Start tracking your expenses"}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const netPrefix = section.dailyNet > 0 ? "+" : section.dailyNet < 0 ? "−" : "";
          return (
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.sectionTotals}>
                <View style={styles.sectionNetPill(section.dailyNet)}>
                  <Text style={styles.sectionNetText(section.dailyNet)}>
                    {netPrefix}
                    {formatCurrency(Math.abs(section.dailyNet), currency || "USD")}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <View style={styles.dayCard}>
            <View style={styles.dayCardAccent} />
            {item.transactions.map((transaction, index) => {
              const notePreview = transaction.note.trim().length
                ? truncateWords(transaction.note, 10)
                : "No notes";
              const visual = getTransactionVisualState(transaction, selectedAccountId);
              const isTransfer = transaction.type === "transfer";
              const transferLabel = isTransfer
                ? `${resolveAccountName(transaction.accountId)} → ${resolveAccountName(transaction.toAccountId)}`
                : null;
              const isLast = index === item.transactions.length - 1;

              return (
                <Pressable
                  key={transaction.id}
                  style={styles.transactionItem}
                  onPress={() => router.push(`/transactions/${transaction.id}`)}
                  accessibilityRole="button"
                >
                  <View style={styles.timelineColumn}>
                    <View style={styles.timelineBullet(visual.variant)} />
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>
                  <View style={[styles.transactionBody, isLast && styles.transactionBodyLast]}>
                    <View style={styles.transactionHeaderRow}>
                      <View style={styles.transactionTitleRow}>
                        <View style={styles.categoryIcon(visual.variant)}>
                          <Text style={styles.categoryInitial}>
                            {transaction.category.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.transactionCategory} numberOfLines={1}>
                            {transaction.category}
                          </Text>
                          {isTransfer && transferLabel ? (
                            <Text style={styles.transferMeta} numberOfLines={1}>
                              {transferLabel}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.transactionAmount(visual.variant)}>
                        {visual.prefix}
                        {formatCurrency(transaction.amount, currency || "USD")}
                      </Text>
                    </View>
                    <Text style={styles.transactionNote} numberOfLines={2}>
                      {notePreview}
                    </Text>
                    {transaction.excludeFromReports && (
                      <View style={styles.excludedBadge}>
                        <Text style={styles.excludedBadgeText}>Excluded from reports</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Search Modal */}
      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSearch}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeSearch} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Search & Filter</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={theme.colors.textMuted} />
              <TextInput
                value={draftSearchTerm}
                onChangeText={setDraftSearchTerm}
                placeholder="Search notes, categories, people or locations"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            {filtersExpanded && (
              <View style={styles.filters}>
                <Text style={styles.filterSectionTitle}>Amount Range</Text>
                <View style={styles.filterRow}>
                  <TextInput
                    value={minAmount}
                    onChangeText={setMinAmount}
                    keyboardType="numeric"
                    placeholder="Min"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                  <Text style={styles.filterSeparator}>to</Text>
                  <TextInput
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    keyboardType="numeric"
                    placeholder="Max"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                </View>

                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setShowStartPicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>
                      {startDate ? startDate.format("MMM D") : "Start"}
                    </Text>
                  </Pressable>
                  <Text style={styles.filterSeparator}>to</Text>
                  <Pressable
                    onPress={() => setShowEndPicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>
                      {endDate ? endDate.format("MMM D") : "End"}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.filterSectionTitle}>Categories</Text>
                <View style={styles.categoryGrid}>
                  {categories.map((category) => {
                    const selected = selectedCategories.includes(category.name);
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => toggleCategory(category.name)}
                        style={styles.categoryOption(selected)}
                      >
                        <Text style={styles.categoryOptionText(selected)}>
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setFiltersExpanded(!filtersExpanded)}
              style={styles.toggleFilters}
            >
              <Text style={styles.toggleFiltersText}>
                {filtersExpanded ? "Hide" : "Show"} advanced filters
              </Text>
              <Ionicons
                name={filtersExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.colors.primary}
              />
            </Pressable>
          </View>

          <View style={styles.modalFooter}>
            <Pressable onPress={clearFilters} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => handleSearchSubmit(draftSearchTerm)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Apply</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {showStartPicker && (
        <DateTimePicker
          value={(startDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) setStartDate(dayjs(selectedDate));
            if (Platform.OS !== "ios") setShowStartPicker(false);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={(endDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) setEndDate(dayjs(selectedDate));
            if (Platform.OS !== "ios") setShowEndPicker(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingBottom: 100,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    
    // Balance Card
    balanceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    balanceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    balanceLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    balanceValue: (fontSize: number) => ({
      fontSize,
      fontWeight: "700",
      color: theme.colors.text,
    }),
    changeBadge: (positive: number) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: positive >= 0 
        ? `${theme.colors.success}15` 
        : `${theme.colors.danger}15`,
    }),
    changeValue: (positive: number) => ({
      fontSize: 14,
      fontWeight: "600",
      color: positive >= 0 ? theme.colors.success : theme.colors.danger,
    }),
    changePercent: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    metric: {
      flex: 1,
      alignItems: "center",
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    metricValue: (color: string) => ({
      fontSize: 16,
      fontWeight: "600",
      color,
    }),
    metricDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.border,
    },
    
    // Period Selector
    periodScroll: {
      marginBottom: 16,
      marginHorizontal: -16,
    },
    periodContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    periodChip: (active: boolean) => ({
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
    }),
    periodText: (active: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: active ? "#fff" : theme.colors.text,
    }),
    
    // Search and Filters
    searchContainer: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    searchField: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchPlaceholder: {
      fontSize: 15,
      color: theme.colors.textMuted,
    },
    filterButton: (active: boolean) => ({
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: active ? theme.colors.primaryMuted : theme.colors.surface,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }),
    filterBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    filterBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
    },
    
    // Filter Chips
    filterChips: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      borderWidth: 0,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.background,
    },
    filterChipClose: {
      padding: 2,
    },
    clearButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
    },
    clearButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    insightsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    insightCard: {
      flexBasis: "48%",
      flexGrow: 1,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}15`,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
      gap: theme.spacing.xs,
    },
    insightCardWide: {
      flexBasis: "100%",
    },
    insightHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.xs,
    },
    insightLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.colors.textMuted,
    },
    insightValue: (color?: string) => ({
      fontSize: 22,
      fontWeight: "700",
      color: color ?? theme.colors.text,
    }),
    insightIcon: (tone: "success" | "danger" | "primary" | "muted" | "accent") => ({
      width: 32,
      height: 32,
      borderRadius: theme.radii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        tone === "success"
          ? `${theme.colors.success}18`
          : tone === "danger"
            ? `${theme.colors.danger}18`
            : tone === "primary"
              ? `${theme.colors.primary}18`
              : tone === "accent"
                ? `${theme.colors.accent}18`
                : `${theme.colors.border}80`,
    }),
    insightSubtext: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    insightProgress: {
      height: 6,
      borderRadius: 999,
      backgroundColor: `${theme.colors.border}66`,
      overflow: "hidden",
    },
    insightProgressFill: (percentage: number) => ({
      height: "100%",
      width: `${Math.min(Math.max(percentage, 0), 100)}%`,
      backgroundColor: theme.colors.success,
    }),
    ratioBar: {
      height: 6,
      borderRadius: 999,
      backgroundColor: `${theme.colors.border}66`,
      overflow: "hidden",
      marginBottom: theme.spacing.xs,
    },
    ratioFill: (percentage: number) => ({
      height: "100%",
      width: `${Math.min(Math.max(percentage, 0), 150)}%`,
      backgroundColor: theme.colors.danger,
    }),
    accountSection: {
      marginBottom: theme.spacing.xl,
    },
    sectionHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
    },
    sectionHeading: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    accountGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.md,
    },
    accountCard: (active: boolean) => ({
      flexBasis: "48%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
    }),
    accountCardArchived: {
      opacity: 0.65,
    },
    accountAvatar: (active: boolean) => ({
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: active
        ? `${theme.colors.background}33`
        : `${theme.colors.primary}18`,
      alignItems: "center",
      justifyContent: "center",
    }),
    accountDetails: {
      flex: 1,
    },
    accountName: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    accountNameActive: {
      color: theme.colors.background,
    },
    accountBalance: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    accountBalanceActive: {
      color: `${theme.colors.background}CC`,
    },
    
    // Breakdown Card
    breakdownCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}22`,
      marginBottom: theme.spacing.lg,
    },
    breakdownIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
    },
    breakdownPreview: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.md,
    },
    breakdownPill: {
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    breakdownInfo: {
      gap: 4,
    },
    breakdownCategory: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    breakdownAmount: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    breakdownBar: {
      height: 6,
      borderRadius: 999,
      backgroundColor: `${theme.colors.border}80`,
      overflow: "hidden",
    },
    breakdownBarFill: (percentage: number) => ({
      height: "100%",
      width: `${Math.min(Math.max(percentage, 0), 100)}%`,
      backgroundColor: theme.colors.primary,
    }),

    // Recurring Section
    recurringSection: {
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    recurringCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    recurringBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${theme.colors.primary}15`,
    },
    recurringDetails: {
      flex: 1,
      gap: 4,
    },
    recurringCategory: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    recurringNote: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    recurringMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    logButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    logButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.background,
    },
    
    // Transactions List
    transactionsTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 8,
    },
    sectionHeaderContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    sectionTotals: {
      flexDirection: "row",
    },
    sectionNetPill: (net: number) => ({
      backgroundColor:
        net > 0
          ? `${theme.colors.success}25`
          : net < 0
          ? `${theme.colors.danger}25`
          : `${theme.colors.textMuted}25`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    }),
    sectionNetText: (net: number) => ({
      fontSize: 11,
      fontWeight: "700",
      color:
        net > 0
          ? theme.colors.success
          : net < 0
          ? theme.colors.danger
          : theme.colors.textMuted,
      letterSpacing: 0.3,
    }),
    dayCard: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      overflow: "hidden",
      position: "relative",
      gap: theme.spacing.md,
    },
    dayCardAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: `${theme.colors.primary}33`,
    },
    transactionItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
    },
    timelineColumn: {
      width: 18,
      alignItems: "center",
      flexDirection: "column",
      gap: 6,
      paddingTop: 6,
    },
    timelineBullet: (variant: TransactionVisualVariant) => ({
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        variant === "income"
          ? theme.colors.success
          : variant === "expense"
            ? theme.colors.danger
            : theme.colors.primary,
    }),
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: `${theme.colors.border}AA`,
      borderRadius: 2,
    },
    transactionBody: {
      flex: 1,
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.colors.border}55`,
      paddingBottom: theme.spacing.md,
    },
    transactionBodyLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    transactionHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    transactionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      flex: 1,
    },
    categoryIcon: (variant: TransactionVisualVariant) => ({
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      backgroundColor:
        variant === "income"
          ? `${theme.colors.success}22`
          : variant === "expense"
            ? `${theme.colors.danger}22`
            : `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    }),
    categoryInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionCategory: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    transactionNote: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    transferMeta: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    transactionAmount: (variant: TransactionVisualVariant) => ({
      fontSize: 15,
      fontWeight: "700",
      color:
        variant === "income"
          ? theme.colors.success
          : variant === "expense"
            ? theme.colors.danger
            : theme.colors.text,
    }),
    excludedBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.border}55`,
    },
    excludedBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    separator: {
      height: 8,
    },
    
    // Empty State
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    
    // Modal
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalClose: {
      padding: 4,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalSpacer: {
      width: 32,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    searchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    filters: {
      gap: 16,
    },
    filterSectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    filterInput: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: 15,
      color: theme.colors.text,
    },
    filterSeparator: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    dateButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    dateButtonText: {
      fontSize: 15,
      color: theme.colors.text,
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryOption: (selected: boolean) => ({
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.surface,
      borderWidth: 1,
      borderColor: selected ? theme.colors.primaryMuted : theme.colors.border,
    }),
    categoryOptionText: (selected: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: selected ? "#fff" : theme.colors.text,
    }),
    toggleFilters: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
    },
    toggleFiltersText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    modalFooter: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    primaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
  });