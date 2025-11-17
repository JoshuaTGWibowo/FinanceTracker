import { Fragment, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAppTheme, type Theme } from "../../theme";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount, getTransactionDelta } from "../../lib/transactions";
import { useFinanceStore } from "../../lib/store";

interface WeeklyBucket {
  label: string;
  income: number;
  expense: number;
  net: number;
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
}

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  }).format(value);

const buildWeeklyRanges = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  const weeks: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
  let cursor = start.startOf("day");

  while (!cursor.isAfter(end)) {
    const rangeEnd = cursor.add(6, "day");
    const boundedEnd = rangeEnd.isAfter(end) ? end : rangeEnd;
    weeks.push({ start: cursor, end: boundedEnd.endOf("day") });
    cursor = boundedEnd.add(1, "day").startOf("day");
  }

  return weeks;
};

const WeeklyStackedBarChart = ({ data, theme }: { data: WeeklyBucket[]; theme: Theme }) => {
  const maxValue = useMemo(() => {
    if (!data.length) return 1;
    const maxIncome = Math.max(...data.map((item) => item.income), 0);
    const maxExpense = Math.max(...data.map((item) => item.expense), 0);
    return Math.max(maxIncome, maxExpense, 1);
  }, [data]);

  const BAR_WIDTH = 28;
  const BAR_GAP = 18;
  const CHART_HEIGHT = 180;
  const chartWidth = data.length * BAR_WIDTH + Math.max(0, data.length - 1) * BAR_GAP;

  return (
    <View style={{ paddingVertical: 12 }}>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Rect x={0} y={CHART_HEIGHT / 2} width={chartWidth} height={1} fill={theme.colors.border} />
        {data.map((item, index) => {
          const x = index * (BAR_WIDTH + BAR_GAP);
          const incomeHeight = (item.income / maxValue) * (CHART_HEIGHT / 2 - 32);
          const expenseHeight = (item.expense / maxValue) * (CHART_HEIGHT / 2 - 32);

          return (
            <Fragment key={item.label}>
              <Rect
                x={x}
                y={CHART_HEIGHT / 2 - incomeHeight}
                rx={8}
                width={BAR_WIDTH}
                height={incomeHeight}
                fill={theme.colors.primary}
                opacity={0.9}
              />
              <Rect
                x={x}
                y={CHART_HEIGHT / 2}
                rx={8}
                width={BAR_WIDTH}
                height={expenseHeight}
                fill={theme.colors.danger}
                opacity={0.9}
              />
              <SvgText
                x={x + BAR_WIDTH / 2}
                y={CHART_HEIGHT - 8}
                fontSize={12}
                fill={theme.colors.textMuted}
                fontWeight="600"
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

export default function NetIncomeDetailsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { period: periodParam, accountId } = useLocalSearchParams<{ period?: string; accountId?: string }>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const baseCurrency = currency || "USD";
  const visibleAccounts = useMemo(
    () => accounts.filter((account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency),
    [accounts, baseCurrency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    () => (typeof accountId === "string" && accountId.length ? accountId : null),
  );
  const selectedAccountName = useMemo(() => {
    if (!selectedAccountId) return "All accounts";
    return accounts.find((account) => account.id === selectedAccountId)?.name ?? "Selected account";
  }, [accounts, selectedAccountId]);

  const periodOptions = useMemo(() => buildMonthlyPeriods().slice().reverse(), []);
  const resolvedPeriod = useMemo(() => {
    const key = typeof periodParam === "string" ? periodParam : undefined;
    return periodOptions.find((option) => option.key === key) ?? periodOptions[0];
  }, [periodOptions, periodParam]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => resolvedPeriod.key);
  const selectedPeriod = useMemo(
    () => periodOptions.find((option) => option.key === selectedPeriodKey) ?? resolvedPeriod,
    [periodOptions, resolvedPeriod, selectedPeriodKey],
  );
  const { start, end } = useMemo(() => selectedPeriod.range(), [selectedPeriod]);

  const scopedTransactions = useMemo(() => {
    const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);

    return filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
      if (!allowedAccountIds || allowedAccountIds.size === 0) {
        return true;
      }

      const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
      const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

      return fromAllowed || toAllowed;
    });
  }, [selectedAccountId, transactions, visibleAccountIds]);

  const reportable = useMemo(
    () =>
      scopedTransactions.filter((transaction) => {
        const date = dayjs(transaction.date);
        return !transaction.excludeFromReports && !date.isBefore(start) && !date.isAfter(end);
      }),
    [scopedTransactions, start, end],
  );

  const totals = useMemo(
    () =>
      reportable.reduce(
        (acc, transaction) => {
          if (transaction.type === "income") acc.income += transaction.amount;
          if (transaction.type === "expense") acc.expense += transaction.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [reportable],
  );

  const netChange = useMemo(
    () => reportable.reduce((acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId), 0),
    [reportable, selectedAccountId],
  );

  const weeklyBuckets = useMemo<WeeklyBucket[]>(() => {
    const weeks = buildWeeklyRanges(start, end);
    return weeks.map((week) => {
      const windowTransactions = reportable.filter((transaction) => {
        const date = dayjs(transaction.date);
        return !date.isBefore(week.start) && !date.isAfter(week.end);
      });
      const income = windowTransactions
        .filter((transaction) => transaction.type === "income")
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      const expense = windowTransactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      const net = windowTransactions.reduce(
        (acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId),
        0,
      );

      const startLabel = week.start.format("D");
      const endLabel = week.end.format("D");
      const label = startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;

      return {
        label,
        income,
        expense,
        net,
        start: week.start,
        end: week.end,
      };
    });
  }, [end, reportable, selectedAccountId, start]);

  const currentPeriodIndex = periodOptions.findIndex((option) => option.key === selectedPeriodKey);
  const canGoPrevious = currentPeriodIndex < periodOptions.length - 1;
  const canGoNext = currentPeriodIndex > 0;

  const changePeriod = (direction: "prev" | "next") => {
    if (direction === "prev" && canGoPrevious) {
      setSelectedPeriodKey(periodOptions[currentPeriodIndex + 1].key);
    }
    if (direction === "next" && canGoNext) {
      setSelectedPeriodKey(periodOptions[currentPeriodIndex - 1].key);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Net income details</Text>
          <Text style={styles.headerSubtitle}>{selectedAccountName}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/transactions/report")}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to report"
        >
          <Ionicons name="stats-chart" size={20} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Period</Text>
            <View style={styles.periodRow}>
              <Pressable
                onPress={() => changePeriod("prev")}
                disabled={!canGoPrevious}
                style={[styles.pillButton, !canGoPrevious && styles.pillButtonDisabled(theme)]}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={canGoPrevious ? theme.colors.text : theme.colors.textMuted}
                />
              </Pressable>
              <View style={styles.periodMeta}>
                <Text style={styles.periodTitle}>{selectedPeriod.label}</Text>
                <Text style={styles.periodRange}>{`${start.format("MMM D")} • ${end.format("MMM D, YYYY")}`}</Text>
              </View>
              <Pressable
                onPress={() => changePeriod("next")}
                disabled={!canGoNext}
                style={[styles.pillButton, !canGoNext && styles.pillButtonDisabled(theme)]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={canGoNext ? theme.colors.text : theme.colors.textMuted}
                />
              </Pressable>
            </View>
            {selectedAccountId && (
              <View style={styles.chipRow}>
                <Text style={styles.chipLabel}>Filtered by account:</Text>
                <View style={styles.chip}>
                  <Ionicons name="wallet" size={14} color={theme.colors.text} />
                  <Text style={styles.chipText}>{selectedAccountName}</Text>
                  <Pressable onPress={() => setSelectedAccountId(null)} style={styles.chipClose}>
                    <Ionicons name="close" size={12} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Monthly net</Text>
            <Text style={styles.netValue(netChange >= 0)}>
              {formatCurrency(netChange, currency, { signDisplay: "always" })}
            </Text>
            <View style={styles.netBreakdown}>
              <View>
                <Text style={styles.netLabel}>Income</Text>
                <Text style={styles.netAmount(theme.colors.primary)}>{formatCurrency(totals.income, currency)}</Text>
              </View>
              <View>
                <Text style={styles.netLabel}>Expense</Text>
                <Text style={styles.netAmount(theme.colors.danger)}>{formatCurrency(totals.expense, currency)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Weekly breakdown</Text>
              <Text style={styles.chartSubtitle}>Tap a week to inspect its transactions</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={styles.legendText}>Income</Text>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} />
              <Text style={styles.legendText}>Expense</Text>
            </View>
          </View>
          <WeeklyStackedBarChart data={weeklyBuckets} theme={theme} />

          <View style={styles.weekList}>
            {weeklyBuckets.map((week) => (
              <Pressable
                key={week.label}
                style={styles.weekRow}
                onPress={() =>
                  router.push({
                    pathname: "/transactions/net-income-week",
                    params: {
                      start: week.start.toISOString(),
                      end: week.end.toISOString(),
                      accountId: selectedAccountId ?? "",
                    },
                  })
                }
                accessibilityRole="button"
              >
                <View>
                  <Text style={styles.weekLabel}>{`Days ${week.label}`}</Text>
                  <Text style={styles.weekRange}>{`${week.start.format("MMM D")} – ${week.end.format(
                    "MMM D",
                  )}`}</Text>
                </View>
                <View style={styles.weekMeta}>
                  <Text style={styles.weekIncome}>{formatCurrency(week.income, currency)}</Text>
                  <Text style={styles.weekExpense}>{formatCurrency(week.expense, currency)}</Text>
                  <View style={styles.weekNetBadge(week.net >= 0, theme)}>
                    <Text style={styles.weekNetText}>{formatCurrency(week.net, currency, { signDisplay: "always" })}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
            {!weeklyBuckets.length && <Text style={styles.emptyText}>No activity in this period yet.</Text>}
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
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerMeta: {
      flex: 1,
      marginHorizontal: theme.spacing.md,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    content: {
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.xl + 16,
    },
    cardRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "wrap",
    },
    card: {
      ...theme.components.card,
      flex: 1,
      minWidth: 200,
      gap: theme.spacing.sm,
    },
    cardLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
    },
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    periodMeta: {
      flex: 1,
      gap: 4,
    },
    periodTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodRange: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    pillButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${theme.colors.border}88`,
    },
    pillButtonDisabled: (currentTheme: Theme) => ({
      backgroundColor: `${currentTheme.colors.surface}80`,
    }),
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    chipLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 8,
      backgroundColor: `${theme.colors.primary}12`,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}35`,
    },
    chipText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: "600",
    },
    chipClose: {
      padding: 4,
      marginLeft: 4,
    },
    netValue: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "800",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    netBreakdown: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    netLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    netAmount: (color: string) => ({
      fontSize: 16,
      fontWeight: "700",
      color,
    }),
    chartCard: {
      ...theme.components.card,
      gap: theme.spacing.md,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    chartSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    weekList: {
      gap: 10,
    },
    weekRow: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: `${theme.colors.border}60`,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    weekLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekRange: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    weekMeta: {
      alignItems: "flex-end",
      gap: 2,
    },
    weekIncome: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: "700",
    },
    weekExpense: {
      fontSize: 13,
      color: theme.colors.danger,
      fontWeight: "700",
    },
    weekNetBadge: (positive: boolean, currentTheme: Theme) => ({
      marginTop: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: currentTheme.radii.lg,
      backgroundColor: positive ? `${currentTheme.colors.success}15` : `${currentTheme.colors.danger}18`,
      borderWidth: 1,
      borderColor: positive ? `${currentTheme.colors.success}40` : `${currentTheme.colors.danger}40`,
    }),
    weekNetText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyText: {
      textAlign: "center",
      color: theme.colors.textMuted,
      marginTop: theme.spacing.md,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${theme.colors.border}80`,
    },
  });
