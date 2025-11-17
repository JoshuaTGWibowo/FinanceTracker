import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs, { Dayjs } from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount, getTransactionDelta } from "../../lib/transactions";

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

interface WeeklySlice {
  key: string;
  label: string;
  start: Dayjs;
  end: Dayjs;
  income: number;
  expense: number;
  net: number;
}

const buildWeeklySlices = (start: Dayjs, end: Dayjs): Pick<WeeklySlice, "key" | "label" | "start" | "end">[] => {
  const slices: Pick<WeeklySlice, "key" | "label" | "start" | "end">[] = [];
  let cursor = start.startOf("day");

  while (!cursor.isAfter(end)) {
    const sliceEndCandidate = cursor.add(6, "day");
    const sliceEnd = sliceEndCandidate.isAfter(end) ? end : sliceEndCandidate;
    const label = `${cursor.date()}–${sliceEnd.date()}`;
    slices.push({
      key: `${cursor.format("YYYY-MM-DD")}-${sliceEnd.format("YYYY-MM-DD")}`,
      label,
      start: cursor,
      end: sliceEnd,
    });
    cursor = sliceEnd.add(1, "day");
  }

  return slices;
};

export default function NetIncomeDetailsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { period: periodParam, accountId } = useLocalSearchParams<{ period?: string; accountId?: string }>();

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const baseCurrency = currency || "USD";
  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency,
      ),
    [accounts, baseCurrency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const selectedAccountId = useMemo(() => {
    if (typeof accountId === "string" && accountId.length) {
      return accountId;
    }
    return null;
  }, [accountId]);

  const selectedAccount = useMemo(
    () => (selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) : null),
    [accounts, selectedAccountId],
  );

  const periodOptions = useMemo(() => buildMonthlyPeriods(14), []);
  const resolvedPeriod = useMemo(() => {
    const key = typeof periodParam === "string" ? periodParam : undefined;
    return periodOptions.find((option) => option.key === key) ?? periodOptions[periodOptions.length - 1];
  }, [periodOptions, periodParam]);

  const { start, end } = useMemo(() => resolvedPeriod.range(), [resolvedPeriod]);

  const scopedTransactions = useMemo(() => {
    const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);

    return filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
      if (transaction.excludeFromReports) {
        return false;
      }

      if (allowedAccountIds && allowedAccountIds.size > 0) {
        const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
        const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

        if (!fromAllowed && !toAllowed) {
          return false;
        }
      }

      const date = dayjs(transaction.date);
      return !date.isBefore(start) && !date.isAfter(end);
    });
  }, [end, selectedAccountId, start, transactions, visibleAccountIds]);

  const weeklySlices = useMemo<WeeklySlice[]>(() => {
    const slices = buildWeeklySlices(start, end);

    return slices.map((slice) => {
      const weeklyTransactions = scopedTransactions.filter((transaction) => {
        const date = dayjs(transaction.date);
        return !date.isBefore(slice.start) && !date.isAfter(slice.end);
      });

      const income = weeklyTransactions
        .filter((transaction) => transaction.type === "income")
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      const expense = weeklyTransactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      const net = weeklyTransactions.reduce(
        (acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId),
        0,
      );

      return { ...slice, income, expense, net };
    });
  }, [end, scopedTransactions, selectedAccountId, start]);

  const totals = useMemo(
    () =>
      weeklySlices.reduce(
        (acc, slice) => {
          acc.income += slice.income;
          acc.expense += slice.expense;
          acc.net += slice.net;
          return acc;
        },
        { income: 0, expense: 0, net: 0 },
      ),
    [weeklySlices],
  );

  const maxMagnitude = useMemo(() => {
    if (!weeklySlices.length) {
      return 1;
    }
    const values = weeklySlices.map((slice) => Math.max(Math.abs(slice.income), Math.abs(slice.expense), Math.abs(slice.net)));
    return Math.max(...values, 1);
  }, [weeklySlices]);

  const accountLabel = selectedAccount ? selectedAccount.name : "All accounts";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close net income details"
        >
          <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Net income details</Text>
          <Text style={styles.headerSubtitle}>
            {resolvedPeriod.label} · {accountLabel}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryLabel}>Total net income</Text>
              <Text style={styles.summaryValue(totals.net >= 0)}>
                {formatCurrency(totals.net, currency, { signDisplay: "always" })}
              </Text>
            </View>
            <View style={styles.chip}>
              <Ionicons name="calendar" color={theme.colors.primary} size={16} />
              <Text style={styles.chipText}>{resolvedPeriod.label}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.pillLabel}>Income</Text>
              <Text style={styles.pillValue(theme.colors.success)}>
                {formatCurrency(totals.income, currency)}
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.pillLabel}>Expense</Text>
              <Text style={styles.pillValue(theme.colors.danger)}>
                {formatCurrency(totals.expense, currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly pulse</Text>
            <Text style={styles.cardSubtitle}>Income vs expense, capped to this month</Text>
          </View>
          {weeklySlices.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartContent}>
              {weeklySlices.map((slice) => {
                const incomeHeight = Math.max(6, (slice.income / maxMagnitude) * 110);
                const expenseHeight = Math.max(6, (slice.expense / maxMagnitude) * 110);

                return (
                  <View key={slice.key} style={styles.barColumn}>
                    <View style={styles.barStack}>
                      <View style={[styles.barPositive, { height: incomeHeight }]} />
                      <View style={styles.barDivider} />
                      <View style={[styles.barNegative, { height: expenseHeight }]} />
                    </View>
                    <Text style={styles.barLabel}>{slice.label}</Text>
                    <Text style={styles.barValue(slice.net >= 0)}>
                      {formatCurrency(slice.net, currency, { maximumFractionDigits: 0, signDisplay: "always" })}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No reportable transactions for this period.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly breakdown</Text>
            <Text style={styles.cardSubtitle}>Tap a week to drill into transactions</Text>
          </View>
          <View style={styles.weekList}>
            {weeklySlices.length === 0 && <Text style={styles.emptyText}>Nothing to show yet.</Text>}
            {weeklySlices.map((slice) => {
              const positive = slice.net >= 0;
              return (
                <Pressable
                  key={slice.key}
                  style={styles.weekRow}
                  onPress={() =>
                    router.push({
                      pathname: "/transactions/net-income-week",
                      params: {
                        start: slice.start.toISOString(),
                        end: slice.end.toISOString(),
                        label: slice.label,
                        period: resolvedPeriod.key,
                        accountId: selectedAccountId ?? "",
                      },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`View transactions for ${slice.label}`}
                >
                  <View style={styles.weekMeta}>
                    <Text style={styles.weekLabel}>{slice.label}</Text>
                    <Text style={styles.weekSubLabel}>
                      {slice.start.format("MMM D")} – {slice.end.format("MMM D")}
                    </Text>
                  </View>
                  <View style={styles.weekStats}>
                    <Text style={styles.weekNet(positive)}>
                      {formatCurrency(slice.net, currency, { signDisplay: "always" })}
                    </Text>
                    <Text style={styles.weekIncome}>Income {formatCurrency(slice.income, currency)}</Text>
                    <Text style={styles.weekExpense}>Expense {formatCurrency(slice.expense, currency)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    headerMeta: { flex: 1, gap: 4 },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    headerSpacer: { width: 40 },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    summaryCard: {
      ...theme.components.card,
      gap: theme.spacing.lg,
      borderRadius: theme.radii.lg,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    summaryValue: (positive: boolean) => ({
      fontSize: 30,
      fontWeight: "800",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    summaryRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "wrap",
    },
    summaryPill: {
      flex: 1,
      minWidth: 140,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
      gap: 6,
    },
    pillLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      letterSpacing: 0.8,
    },
    pillValue: (color: string) => ({
      fontSize: 18,
      fontWeight: "700",
      color,
    }),
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.primary}18`,
    },
    chipText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    card: {
      ...theme.components.card,
      gap: theme.spacing.lg,
    },
    cardHeader: { gap: 4 },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    cardSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    chartContent: {
      gap: theme.spacing.lg,
      paddingRight: theme.spacing.lg,
    },
    barColumn: {
      alignItems: "center",
      width: 94,
      gap: 6,
    },
    barStack: {
      width: "100%",
      height: 140,
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    barPositive: {
      width: "70%",
      borderRadius: theme.radii.sm,
      backgroundColor: `${theme.colors.success}dd`,
    },
    barNegative: {
      width: "70%",
      borderRadius: theme.radii.sm,
      backgroundColor: `${theme.colors.danger}dd`,
    },
    barDivider: {
      width: "100%",
      height: 1,
      backgroundColor: `${theme.colors.textMuted}33`,
    },
    barLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.text,
    },
    barValue: (positive: boolean) => ({
      fontSize: 12,
      color: positive ? theme.colors.success : theme.colors.danger,
      fontWeight: "700",
    }),
    emptyText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    weekList: {
      gap: theme.spacing.sm,
    },
    weekRow: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: `${theme.colors.border}99`,
    },
    weekMeta: { flex: 1, gap: 2 },
    weekLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekSubLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    weekStats: { gap: 4 },
    weekNet: (positive: boolean) => ({
      fontSize: 16,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    weekIncome: {
      fontSize: 12,
      color: theme.colors.success,
      fontWeight: "700",
    },
    weekExpense: {
      fontSize: 12,
      color: theme.colors.danger,
      fontWeight: "700",
    },
  });
