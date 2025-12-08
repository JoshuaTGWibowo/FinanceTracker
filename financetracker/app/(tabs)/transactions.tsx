import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
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
import { Category, Transaction, TransactionType, useFinanceStore } from "../../lib/store";
import {
  filterTransactionsByAccount,
  getTransactionDelta,
  getTransactionVisualState,
  sortTransactionsByRecency,
  type TransactionVisualVariant,
} from "../../lib/transactions";
import { truncateWords } from "../../lib/text";
import { buildMonthlyPeriods } from "../../lib/periods";

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) => {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = Math.min(options?.minimumFractionDigits ?? 0, maximumFractionDigits);

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    ...options,
    maximumFractionDigits,
    minimumFractionDigits,
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

const toIconName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const logRecurringTransaction = useFinanceStore((state) => state.logRecurringTransaction);
  const accounts = useFinanceStore((state) => state.accounts);
  const router = useRouter();
  const { category: categoryParam, date: dateParam } = useLocalSearchParams<{ category?: string | string[]; date?: string }>();

  const baseCurrency = currency || "USD";

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
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
  
  // Default to current month
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const currentMonthKey = dayjs().startOf("month").format("YYYY-MM");
    const currentMonth = periodOptions.find(p => p.key === currentMonthKey);
    return currentMonth?.key ?? periodOptions[periodOptions.length - 1]?.key ?? "";
  });
  
  // Auto-scroll to current month on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const today = dayjs().startOf("day");

    recurringTransactions
      .filter((item) => item.isActive)
      .forEach((item) => {
        const occurrence = dayjs(item.nextOccurrence);
        if (occurrence.isSame(today, "day")) {
          void logRecurringTransaction(item.id);
        }
      });
  }, [logRecurringTransaction, recurringTransactions]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<
    Extract<TransactionType, "expense" | "income"> | null
  >(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const selectedAccountId = useFinanceStore((state) => state.selectedAccountId);
  const setSelectedAccountId = useFinanceStore((state) => state.setSelectedAccountId);
  const addAccount = useFinanceStore((state) => state.addAccount);

  const [createAccountModalVisible, setCreateAccountModalVisible] = useState(false);
  const [accountFormName, setAccountFormName] = useState("");
  const [accountFormType, setAccountFormType] = useState<"cash" | "bank" | "card" | "investment">("bank");
  const [accountFormCurrency, setAccountFormCurrency] = useState(currency);
  const [accountFormInitialBalance, setAccountFormInitialBalance] = useState("");
  const [accountFormExcludeFromTotal, setAccountFormExcludeFromTotal] = useState(false);
  const [recurringExpanded, setRecurringExpanded] = useState(false);

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
    const match = categories.find((category) => normalized.includes(category.name));
    if (match) {
      setSelectedCategoryId(match.id);
      setCategoryTypeFilter(normalizeCategoryType(match.type));
    }
  }, [categories, categoryParam]);

  // Handle date parameter from calendar navigation
  useEffect(() => {
    if (!dateParam) {
      return;
    }

    const date = dayjs(dateParam);
    if (!date.isValid()) {
      return;
    }

    // Set both start and end date to the same date for single-day filter
    setStartDate(date);
    setEndDate(date);
    setFiltersExpanded(true);

    // Set the period to the month containing this date
    const monthKey = date.startOf("month").format("YYYY-MM");
    setSelectedPeriod(monthKey);

    // Clear the date param from URL after applying the filter
    router.replace("/(tabs)/transactions");
  }, [dateParam, router]);

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

  const normalizeCategoryType = (type?: Category["type"]): Extract<TransactionType, "expense" | "income"> =>
    type === "income" ? "income" : "expense";

  const handleSaveAccount = useCallback(async () => {
    if (!accountFormName.trim()) {
      Alert.alert("Heads up", "Give the account a name first.");
      return;
    }

    if (!accountFormCurrency.trim()) {
      Alert.alert("Heads up", "Currency code cannot be empty.");
      return;
    }

    const sanitizedBalance = accountFormInitialBalance.replace(/[^0-9.-]/g, "");
    const parsedInitial = sanitizedBalance ? Number(sanitizedBalance) : 0;
    const initialBalanceValue = Number.isNaN(parsedInitial) ? 0 : parsedInitial;
    const normalizedCurrency = accountFormCurrency.trim().toUpperCase();

    const newAccountId = await addAccount({
      name: accountFormName,
      type: accountFormType,
      currency: normalizedCurrency,
      initialBalance: initialBalanceValue,
      excludeFromTotal: accountFormExcludeFromTotal,
    });

    setCreateAccountModalVisible(false);
    
    if (newAccountId) {
      setSelectedAccountId(newAccountId);
    }
  }, [accountFormName, accountFormType, accountFormCurrency, accountFormInitialBalance, accountFormExcludeFromTotal, addAccount, setSelectedAccountId]);

  const selectedCategory = useMemo(
    () => (selectedCategoryId ? categories.find((category) => category.id === selectedCategoryId) ?? null : null),
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    if (selectedCategory && categoryTypeFilter) {
      const derived = normalizeCategoryType(selectedCategory.type);
      if (derived !== categoryTypeFilter) {
        setSelectedCategoryId(null);
      }
    }
  }, [categoryTypeFilter, selectedCategory]);

  const filteredCategoriesForPicker = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const matchesSearch = (category: Category) =>
      query ? category.name.toLowerCase().includes(query) : true;

    const typeFiltered = categoryTypeFilter
      ? categories.filter((category) => normalizeCategoryType(category.type) === categoryTypeFilter)
      : categories;

    const childrenMap = new Map<string, Category[]>();

    typeFiltered.forEach((category) => {
      if (category.parentCategoryId) {
        const children = childrenMap.get(category.parentCategoryId) ?? [];
        children.push(category);
        childrenMap.set(category.parentCategoryId, children);
      }
    });

    const parents = typeFiltered.filter((category) => !category.parentCategoryId);
    const orphans = typeFiltered.filter(
      (category) => category.parentCategoryId && !parents.find((parent) => parent.id === category.parentCategoryId),
    );

    return [
      ...parents.map((parent) => ({ parent, children: childrenMap.get(parent.id) ?? [] })),
      ...orphans.map((parent) => ({ parent, children: [] })),
    ]
      .map((group) => {
        const visibleChildren = query ? group.children.filter((child) => matchesSearch(child)) : group.children;
        return {
          ...group,
          children: visibleChildren,
          visible: matchesSearch(group.parent) || visibleChildren.length > 0,
        };
      })
      .filter((group) => group.visible)
      .sort((a, b) => a.parent.name.localeCompare(b.parent.name));
  }, [categories, categorySearch, categoryTypeFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setDraftSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSelectedCategoryId(null);
    setCategoryTypeFilter(null);
    setCategorySearch("");
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
    setCategoryPickerVisible(false);
    setCategorySearch("");
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
    if (categoryTypeFilter) {
      filters.push({
        key: `type-${categoryTypeFilter}`,
        label: categoryTypeFilter === "income" ? "Income" : "Expense",
        type: "categoryType",
      });
    }
    if (selectedCategory) {
      filters.push({
        key: `cat-${selectedCategory.id}`,
        label: selectedCategory.name,
        type: "category",
        value: selectedCategory.id,
      });
    }
    return filters;
  }, [categoryTypeFilter, currency, endDate, maxAmount, minAmount, searchTerm, selectedCategory, startDate]);

  const hasActiveFilters = activeFilters.length > 0;

  const { sections, summary, filteredRecurring } = useMemo(() => {
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
      if (categoryTypeFilter && transaction.type !== categoryTypeFilter) {
        return false;
      }

      if (selectedCategory && transaction.category !== selectedCategory.name) {
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

    // Recurring transactions
    const recurring = recurringTransactions.filter((item) => {
      if (!item.isActive) {
        return false;
      }
      const occurrence = dayjs(item.nextOccurrence);
      const matchesAccount =
        !selectedAccountId || item.accountId === selectedAccountId || item.toAccountId === selectedAccountId;
      return matchesAccount && !occurrence.isBefore(start) && !occurrence.isAfter(end);
    });
    recurring.sort((a, b) => dayjs(a.nextOccurrence).valueOf() - dayjs(b.nextOccurrence).valueOf());

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
    categoryTypeFilter,
    selectedCategory,
    selectedAccountId,
    startDate,
    transactions,
    visibleAccountIds,
  ]);

  const closingBalanceDisplay = useMemo(
    () => formatCurrency(summary.closingBalance, currency || "USD"),
    [currency, summary.closingBalance],
  );

  const balanceFontSize = useMemo(() => {
    const digitCount = closingBalanceDisplay.replace(/[^0-9]/g, "").length;
    if (digitCount <= 6) return 32;
    if (digitCount <= 9) return 28;
    if (digitCount <= 12) return 24;
    return 20;
  }, [closingBalanceDisplay]);

  const handleOpenReport = useCallback(() => {
    const defaultPeriod = periodOptions[periodOptions.length - 1];
    const periodKey = selectedPeriod || defaultPeriod?.key;
    if (!periodKey) {
      return;
    }

    // Don't allow report for future period
    const currentPeriod = periodOptions.find((p) => p.key === periodKey);
    if (currentPeriod?.isFuture) {
      return;
    }

    const params: Record<string, string> = { period: periodKey };
    if (selectedAccountId) {
      params.accountId = selectedAccountId;
    }

    router.push({
      pathname: "/transactions/report",
      params,
    });
  }, [periodOptions, router, selectedAccountId, selectedPeriod]);

  const isReportDisabled = useMemo(() => {
    const defaultPeriod = periodOptions[periodOptions.length - 1];
    const periodKey = selectedPeriod || defaultPeriod?.key;
    const currentPeriod = periodOptions.find((p) => p.key === periodKey);
    return currentPeriod?.isFuture || false;
  }, [periodOptions, selectedPeriod]);

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

              <Pressable 
                style={[styles.reportButton, isReportDisabled && styles.reportButtonDisabled]} 
                onPress={handleOpenReport}
                disabled={isReportDisabled}
              >
                <Text style={[styles.reportButtonText, isReportDisabled && styles.reportButtonTextDisabled]}>
                  {isReportDisabled ? "Report not available for future" : "View report for this period"}
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={isReportDisabled ? theme.colors.textMuted : theme.colors.primary} 
                />
              </Pressable>
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
                        else if (filter.type === "category") setSelectedCategoryId(null);
                        else if (filter.type === "categoryType") setCategoryTypeFilter(null);
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountChipRow}
            >
            <Pressable
              onPress={() => setSelectedAccountId(null)}
              style={[styles.accountChip, !selectedAccountId && styles.accountChipActive]}
            >
              <Text style={styles.accountChipTitle}>All accounts</Text>
              <Text style={styles.accountChipBalance}>
                {formatCurrency(allAccountsBalance, baseCurrency)}
              </Text>
            </Pressable>
            {accounts.map((account) => {
              const active = selectedAccountId === account.id;
              return (
                <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={[
                      styles.accountChip,
                      active && styles.accountChipActive,
                      account.isArchived && styles.accountChipArchived,
                    ]}
                  >
                    <Text style={styles.accountChipTitle}>{account.name}</Text>
                    <Text style={styles.accountChipBalance}>
                      {formatCurrency(account.balance, account.currency || baseCurrency)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  setAccountFormName("");
                  setAccountFormType("bank");
                  setAccountFormCurrency(currency);
                  setAccountFormInitialBalance("");
                  setAccountFormExcludeFromTotal(false);
                  setCreateAccountModalVisible(true);
                }}
                style={[styles.accountChip, styles.addAccountChip]}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.accountChipTitle, { color: theme.colors.primary }]}>Add Account</Text>
              </Pressable>
            </ScrollView>

            {/* Recurring Transactions */}
            {filteredRecurring.length > 0 && (
              <View style={styles.recurringSection}>
                <Pressable
                  style={styles.recurringHeader}
                  onPress={() => setRecurringExpanded((prev) => !prev)}
                >
                  <Text style={styles.sectionTitle}>
                    Upcoming Recurring ({filteredRecurring.length})
                  </Text>
                  <Ionicons
                    name={recurringExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
                {recurringExpanded &&
                  filteredRecurring.map((item) => (
                    <View key={item.id} style={styles.recurringItem}>
                      <View style={styles.recurringInfo}>
                        <Text style={styles.recurringCategory}>{item.category}</Text>
                        {item.note ? (
                          <Text style={styles.recurringNote} numberOfLines={2}>
                            {truncateWords(item.note, 10)}
                          </Text>
                        ) : null}
                        <Text style={styles.recurringDate}>
                          {dayjs(item.nextOccurrence).format("MMM D")} • {item.frequency}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void logRecurringTransaction(item.id)}
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
            {item.transactions.map((transaction, index) => {
              const notePreview = transaction.note.trim().length
                ? truncateWords(transaction.note, 10)
                : "No notes";
              const visual = getTransactionVisualState(transaction, selectedAccountId);
              const isTransfer = transaction.type === "transfer";
              const transferLabel = isTransfer
                ? `${resolveAccountName(transaction.accountId)} → ${resolveAccountName(transaction.toAccountId)}`
                : null;

              return (
                <View key={transaction.id}>
                  {index > 0 && <View style={styles.transactionDivider} />}
                  <Pressable
                    style={styles.transactionItem}
                    onPress={() => router.push(`/transactions/${transaction.id}`)}
                    accessibilityRole="button"
                  >
                    <View style={styles.transactionLeft}>
                      <View style={styles.categoryIcon(visual.variant)}>
                        <Text style={styles.categoryInitial}>
                          {transaction.category.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.transactionDetails}>
                        <Text style={styles.transactionCategory} numberOfLines={1}>
                          {transaction.category}
                        </Text>
                        <Text style={styles.transactionNote} numberOfLines={2}>
                          {notePreview}
                        </Text>
                        {isTransfer && transferLabel ? (
                          <Text style={styles.transferMeta} numberOfLines={1}>
                            {transferLabel}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.transactionRight}>
                      <Text style={styles.transactionAmount(visual.variant)}>
                        {visual.prefix}
                        {formatCurrency(transaction.amount, currency || "USD")}
                      </Text>
                      {transaction.excludeFromReports && (
                        <View style={styles.excludedBadge}>
                          <Text style={styles.excludedBadgeText}>Excluded</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                </View>
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

                <Text style={styles.filterSectionTitle}>Type & category</Text>
                <View style={styles.filterCard}>
                  <View style={styles.filterRowHeader}>
                    <Text style={styles.filterCardTitle}>Focus your search</Text>
                    <Ionicons name="pricetag" size={18} color={theme.colors.textMuted} />
                  </View>
                  <View style={styles.typeRow}>
                    {(["expense", "income"] as Extract<TransactionType, "expense" | "income">[]).map(
                      (typeOption) => {
                        const active = categoryTypeFilter === typeOption;
                        return (
                          <Pressable
                            key={typeOption}
                            style={styles.typeChip(active, typeOption)}
                            onPress={() => {
                              setCategoryTypeFilter(active ? null : typeOption);
                              if (selectedCategory && normalizeCategoryType(selectedCategory.type) !== typeOption) {
                                setSelectedCategoryId(null);
                              }
                            }}
                          >
                            <Text style={styles.typeChipText(active)}>
                              {typeOption === "expense" ? "Expense" : "Income"}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>

                  <Pressable
                    style={styles.selectionTile}
                    onPress={() => {
                      setSearchVisible(false);
                      setCategoryPickerVisible(true);
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.selectionTileInfo}>
                      <Text style={styles.selectionLabel}>Category</Text>
                      <Text style={styles.selectionValue}>
                        {selectedCategory ? selectedCategory.name : "Any category"}
                      </Text>
                    </View>
                    <View style={styles.selectionIcon}>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
                    </View>
                  </Pressable>

                  {selectedCategory && (
                    <View style={styles.selectionBadgeRow}>
                      <View style={styles.typeBadge(normalizeCategoryType(selectedCategory.type))}>
                        <Ionicons
                          name={normalizeCategoryType(selectedCategory.type) === "income" ? "arrow-down-circle" : "arrow-up-circle"}
                          size={14}
                          color={theme.colors.text}
                        />
                        <Text style={styles.typeBadgeText}>
                          {normalizeCategoryType(selectedCategory.type) === "income" ? "Income" : "Expense"}
                        </Text>
                      </View>
                    </View>
                  )}
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

      <Modal
        visible={categoryPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setCategoryPickerVisible(false);
          setCategorySearch("");
          setSearchVisible(true);
        }}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                setCategoryPickerVisible(false);
                setCategorySearch("");
                setSearchVisible(true);
              }}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Select category</Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.categoryPickerContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.categoryHeroCard}>
              <View>
                <Text style={styles.heroLabel}>Filter by type</Text>
                <Text style={styles.heroHint}>Choose a type and a category to sharpen results.</Text>
              </View>
              <View style={styles.typeRow}>
                {(["expense", "income"] as Extract<TransactionType, "expense" | "income">[]).map(
                  (typeOption) => {
                    const active = categoryTypeFilter === typeOption;
                    return (
                      <Pressable
                        key={typeOption}
                        style={styles.typeChip(active, typeOption)}
                        onPress={() => {
                          setCategoryTypeFilter(active ? null : typeOption);
                          setCategorySearch("");
                          if (
                            selectedCategory &&
                            normalizeCategoryType(selectedCategory.type) !== typeOption
                          ) {
                            setSelectedCategoryId(null);
                          }
                        }}
                      >
                        <Text style={styles.typeChipText(active)}>
                          {typeOption === "expense" ? "Expense" : "Income"}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>

            <View style={styles.categorySearchRow}>
              <Ionicons name="search" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search categories"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.categorySearchInput}
              />
              {categorySearch ? (
                <Pressable onPress={() => setCategorySearch("")}>
                  <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.categoryGroupGrid}>
              {filteredCategoriesForPicker.length === 0 ? (
                <Text style={styles.emptyText}>No categories match your filters yet.</Text>
              ) : (
                filteredCategoriesForPicker.map((group) => {
                  const iconName = toIconName(group.parent.icon);
                  const isSelected = selectedCategory?.id === group.parent.id;
                  return (
                    <View key={group.parent.id} style={styles.categoryGroupCard}>
                      <Pressable
                        style={styles.parentRow}
                        onPress={() => {
                          setSelectedCategoryId(group.parent.id);
                          setCategoryTypeFilter(normalizeCategoryType(group.parent.type));
                          setCategoryPickerVisible(false);
                          setCategorySearch("");
                          setSearchVisible(true);
                        }}
                      >
                        <View style={styles.avatarCircle}>
                          <Ionicons name={iconName} size={18} color={theme.colors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.parentName}>{group.parent.name}</Text>
                          <Text style={styles.metaText}>Tap to filter by this category</Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                        )}
                      </Pressable>

                      {group.children.length > 0 ? (
                        <View style={styles.childrenList}>
                          {group.children.map((child, index) => {
                            const isLast = index === group.children.length - 1;
                            const childIcon = toIconName(child.icon);
                            const childSelected = selectedCategory?.id === child.id;
                            return (
                              <Pressable
                                key={child.id}
                                style={styles.childRow}
                                onPress={() => {
                                  setSelectedCategoryId(child.id);
                                  setCategoryTypeFilter(normalizeCategoryType(child.type));
                                  setCategoryPickerVisible(false);
                                  setCategorySearch("");
                                  setSearchVisible(true);
                                }}
                              >
                                <View style={styles.connectorColumn}>
                                  <View style={[styles.connectorLine, isLast && styles.connectorLineEnd]} />
                                  <View style={styles.connectorDot} />
                                </View>
                                <View style={styles.childAvatar}>
                                  <Ionicons name={childIcon} size={14} color={theme.colors.text} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.childName}>{child.name}</Text>
                                  <Text style={styles.metaText}>Child category</Text>
                                </View>
                                {childSelected ? (
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={18}
                                    color={theme.colors.primary}
                                  />
                                ) : (
                                  <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color={theme.colors.textMuted}
                                  />
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
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

      {/* Create Account Modal */}
      <Modal
        visible={createAccountModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateAccountModalVisible(false)}
      >
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={24}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Account</Text>
              <Pressable style={styles.modalClose} onPress={() => setCreateAccountModalVisible(false)}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Account Name</Text>
                <TextInput
                  value={accountFormName}
                  onChangeText={setAccountFormName}
                  placeholder="e.g., Main Checking"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.textInput, theme.components.surface, { color: theme.colors.text }]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.accountTypeGrid}>
                  {(["cash", "bank", "card", "investment"] as const).map((type) => {
                    const active = accountFormType === type;
                    const iconName =
                      type === "cash"
                        ? "cash"
                        : type === "bank"
                        ? "business"
                        : type === "card"
                        ? "card"
                        : "trending-up";
                    const label = type === "cash" ? "Cash" : type === "bank" ? "Bank" : type === "card" ? "Card" : "Investment";
                    return (
                      <Pressable
                        key={type}
                        style={[
                          styles.accountTypeCard,
                          theme.components.surface,
                          active && { borderColor: theme.colors.primary, borderWidth: 2 }
                        ]}
                        onPress={() => setAccountFormType(type)}
                      >
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={active ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.accountTypeCardText,
                            { color: theme.colors.text },
                            active && { color: theme.colors.primary, fontWeight: "600" }
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, styles.flexField]}>
                  <Text style={styles.fieldLabel}>Currency</Text>
                  <TextInput
                    value={accountFormCurrency}
                    onChangeText={(text) => setAccountFormCurrency(text.toUpperCase())}
                    placeholder="USD"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={3}
                    style={[styles.textInput, theme.components.surface, { color: theme.colors.text }]}
                  />
                </View>

                <View style={[styles.fieldGroup, styles.flexField]}>
                  <Text style={styles.fieldLabel}>Initial Balance</Text>
                  <TextInput
                    value={accountFormInitialBalance}
                    onChangeText={setAccountFormInitialBalance}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.textInput, theme.components.surface, { color: theme.colors.text }]}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, styles.switchField]}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.fieldLabel}>Exclude from Total</Text>
                  <Text style={[styles.fieldHelperText, { color: theme.colors.textMuted }]}>
                    Don&apos;t include this account in your net worth
                  </Text>
                </View>
                <Switch
                  value={accountFormExcludeFromTotal}
                  onValueChange={setAccountFormExcludeFromTotal}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.background}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveAccount}
              >
                <Text style={styles.saveButtonText}>Create Account</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
      paddingHorizontal: 12,
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
    reportButton: {
      marginTop: 16,
      backgroundColor: `${theme.colors.primary}12`,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}30`,
      paddingVertical: 12,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    reportButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    reportButtonDisabled: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      opacity: 0.6,
    },
    reportButtonTextDisabled: {
      color: theme.colors.textMuted,
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
    accountChipRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    accountChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    accountChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    accountChipArchived: {
      opacity: 0.6,
    },
    accountChipTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    accountChipBalance: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    addAccountChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    
    // Recurring Section
    recurringSection: {
      marginBottom: 12,
    },
    recurringHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 0,
    },
    recurringItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    recurringInfo: {
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
    recurringDate: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    logButton: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
    },
    logButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#fff",
    },
    
    // Transactions List
    transactionsTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 4,
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
      marginHorizontal: 12,
      borderRadius: 12,
      overflow: "hidden",
    },
    transactionItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
    },
    transactionDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 12,
    },
    transactionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    categoryIcon: (variant: TransactionVisualVariant) => ({
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor:
        variant === "income"
          ? `${theme.colors.success}20`
          : variant === "expense"
            ? `${theme.colors.danger}20`
            : `${theme.colors.border}55`,
      alignItems: "center",
      justifyContent: "center",
    }),
    categoryInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionDetails: {
      flex: 1,
      gap: 4,
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
    transactionRight: {
      alignItems: "flex-end",
      gap: 6,
    },
    excludedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.border}55`,
    },
    excludedBadgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
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
    filterCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    filterCardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    typeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    typeChip: (active: boolean, type: TransactionType) => ({
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active
        ? type === "income"
          ? `${theme.colors.success}22`
          : `${theme.colors.danger}22`
        : theme.colors.surface,
    }),
    typeChipText: (active: boolean) => ({
      fontSize: 14,
      fontWeight: "700",
      color: active ? theme.colors.text : theme.colors.textMuted,
    }),
    selectionTile: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    selectionTileInfo: {
      flex: 1,
      gap: 4,
    },
    selectionLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
      color: theme.colors.textMuted,
    },
    selectionValue: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    selectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    selectionBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    typeBadge: (type: Extract<TransactionType, "income" | "expense">) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor:
        type === "income" ? `${theme.colors.success}22` : `${theme.colors.danger}22`,
    }),
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categoryPickerContent: {
      padding: 16,
      paddingBottom: insets.bottom + 16,
      gap: 12,
    },
    categoryHeroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
    },
    heroLabel: {
      fontSize: 12,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.colors.textMuted,
    },
    heroHint: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categorySearchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categorySearchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    categoryGroupGrid: {
      gap: 12,
    },
    categoryGroupCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 10,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 4 },
    },
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    parentName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    childrenList: {
      marginLeft: 8,
      gap: 8,
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 10,
    },
    connectorColumn: {
      width: 18,
      alignItems: "center",
    },
    connectorLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.colors.border,
      marginBottom: 4,
      borderRadius: 4,
    },
    connectorLineEnd: {
      height: 10,
    },
    connectorDot: {
      width: 10,
      height: 10,
      borderRadius: 6,
      backgroundColor: theme.colors.border,
    },
    childAvatar: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    childName: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
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
    modalFlex: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalClose: {
      padding: 8,
    },
    modalBody: {
      flex: 1,
    },
    modalContent: {
      padding: 24,
      gap: 20,
    },
    fieldGroup: {
      marginBottom: 0,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    textInput: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      fontSize: 16,
    },
    accountTypeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    accountTypeCard: {
      flex: 1,
      minWidth: "45%",
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    accountTypeCardText: {
      fontSize: 14,
    },
    rowFields: {
      flexDirection: "row",
      gap: 12,
    },
    flexField: {
      flex: 1,
    },
    switchField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    switchLabelContainer: {
      flex: 1,
    },
    fieldHelperText: {
      fontSize: 12,
      marginTop: 4,
    },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    saveButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
  });