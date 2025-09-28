import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";

import { DonutChart } from "../../components/DonutChart";
import { TrendLineChart } from "../../components/TrendLineChart";
import { useAppTheme } from "../../theme";
import { BudgetGoal, useFinanceStore } from "../../lib/store";

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(value);

const summarizeGoalProgress = (
  goal: BudgetGoal,
  currency: string,
  transactions: ReturnType<typeof useFinanceStore.getState>["transactions"],
) => {
  const now = dayjs();
  const start = goal.period === "week" ? now.startOf("week") : now.startOf("month");
  const end = goal.period === "week" ? now.endOf("week") : now.endOf("month");

  const withinPeriod = transactions.filter((transaction) => {
    const date = dayjs(transaction.date);
    return !date.isBefore(start) && !date.isAfter(end);
  });

  if (goal.category) {
    const spent = withinPeriod
      .filter((transaction) => transaction.type === "expense" && transaction.category === goal.category)
      .reduce((acc, transaction) => acc + transaction.amount, 0);

    return {
      label: `${goal.category} spend`,
      value: spent,
      formatted: formatCurrency(spent, currency),
      percentage: Math.min(1, spent / goal.target || 0),
      direction: "limit" as const,
    };
  }

  const netSavings = withinPeriod.reduce((acc, transaction) => {
    const delta = transaction.type === "income" ? transaction.amount : -transaction.amount;
    return acc + delta;
  }, 0);

  const savingsValue = Math.max(0, netSavings);

  return {
    label: "Net saved",
    value: savingsValue,
    formatted: formatCurrency(savingsValue, currency),
    percentage: Math.min(1, savingsValue / goal.target || 0),
    direction: "save" as const,
  };
};

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const transactions = useFinanceStore((state) => state.transactions);
  const profile = useFinanceStore((state) => state.profile);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const logRecurringTransaction = useFinanceStore((state) => state.logRecurringTransaction);

  const [spendingPeriod, setSpendingPeriod] = useState<"week" | "month">("month");
  const [showBalance, setShowBalance] = useState(true);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const balance = useMemo(
    () =>
      transactions.reduce((acc, transaction) => {
        const multiplier = transaction.type === "income" ? 1 : -1;
        return acc + transaction.amount * multiplier;
      }, 0),
    [transactions],
  );

  const startOfMonth = useMemo(() => dayjs().startOf("month"), []);
  const endOfMonth = useMemo(() => dayjs().endOf("month"), []);

  const summary = useMemo(
    () =>
      transactions.reduce(
        (acc, transaction) => {
          const value = transaction.type === "income" ? transaction.amount : -transaction.amount;
          const date = dayjs(transaction.date);

          if (date.isBefore(startOfMonth)) {
            acc.openingBalance += value;
          }

          if (!date.isBefore(startOfMonth) && !date.isAfter(endOfMonth)) {
            if (transaction.type === "income") {
              acc.income += transaction.amount;
            } else {
              acc.expense += transaction.amount;
            }
            acc.monthNet += value;
          }

          return acc;
        },
        { income: 0, expense: 0, openingBalance: 0, monthNet: 0 },
      ),
    [endOfMonth, startOfMonth, transactions],
  );

  const {
    periodIncome,
    periodExpense,
    incomeSeries,
    expenseSeries,
    netSeries,
    topSpending,
  } = useMemo(() => {
    const today = dayjs();
    const periodStart = spendingPeriod === "week" ? today.startOf("week") : today.startOf("month");
    const periodEnd = spendingPeriod === "week" ? today.endOf("week") : today.endOf("month");

    const filtered = transactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return !date.isBefore(periodStart) && !date.isAfter(periodEnd);
    });

    const totals = filtered.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else {
          acc.expense += transaction.amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );

    const bucketCount = spendingPeriod === "week" ? 7 : periodEnd.diff(periodStart, "day") + 1;
    const labels = Array.from({ length: bucketCount }).map((_, index) => {
      const day = periodStart.add(index, "day");
      return spendingPeriod === "week" ? day.format("dd") : day.format("D");
    });

    const incomeSeries = labels.map((label, index) => {
      const day = periodStart.add(index, "day");
      const value = filtered
        .filter((transaction) => transaction.type === "income" && dayjs(transaction.date).isSame(day, "day"))
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      return { label, value };
    });

    const expenseSeries = labels.map((label, index) => {
      const day = periodStart.add(index, "day");
      const value = filtered
        .filter((transaction) => transaction.type === "expense" && dayjs(transaction.date).isSame(day, "day"))
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      return { label, value };
    });

    const netSeries = labels.map((label, index) => {
      const day = periodStart.add(index, "day");
      const netForDay = filtered
        .filter((transaction) => dayjs(transaction.date).isSame(day, "day"))
        .reduce(
          (acc, transaction) => acc + (transaction.type === "income" ? transaction.amount : -transaction.amount),
          0,
        );
      return { label, value: netForDay };
    });

    const totalsByCategory = filtered.reduce((acc, transaction) => {
      if (transaction.type !== "expense") {
        return acc;
      }
      const previous = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, previous + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const entries = Array.from(totalsByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totals.expense ? Math.round((amount / totals.expense) * 100) : 0,
      }));

    return {
      periodIncome: totals.income,
      periodExpense: totals.expense,
      incomeSeries,
      expenseSeries,
      netSeries,
      topSpending: {
        entries,
        totalSpent: totals.expense,
      },
    };
  }, [spendingPeriod, transactions]);

  const currency = profile.currency || "USD";
  const formattedBalance = formatCurrency(balance, currency);
  const formattedPeriodIncome = formatCurrency(periodIncome, currency);
  const formattedPeriodExpenses = formatCurrency(periodExpense, currency);

  const netChangeThisMonth = summary.income - summary.expense;
  const netIsPositive = netChangeThisMonth >= 0;
  const netBadgeColor = netIsPositive ? theme.colors.success : theme.colors.danger;
  const netBadgeBackground = netIsPositive ? "rgba(52,211,153,0.16)" : "rgba(251,113,133,0.16)";
  const netIcon = netIsPositive ? "trending-up" : "trending-down";
  const netLabel = `${formatCurrency(netChangeThisMonth, currency, { signDisplay: "always" })} this month`;

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4),
    [transactions],
  );

  const trendStart = netSeries[0]?.value ?? 0;
  const trendEnd = netSeries[netSeries.length - 1]?.value ?? 0;
  const trendDelta = trendEnd - trendStart;
  const trendPositive = trendDelta >= 0;

  const upcomingRecurring = useMemo(
    () =>
      recurringTransactions
        .filter((item) => item.isActive)
        .sort((a, b) => new Date(a.nextOccurrence).getTime() - new Date(b.nextOccurrence).getTime())
        .slice(0, 3),
    [recurringTransactions],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.hello}>Welcome back, {profile.name.split(" ")[0]}</Text>
          <Text style={styles.subtitle}>Here’s a tidy look at your money this month.</Text>
        </View>

        <View style={[theme.components.card, styles.balanceCard]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Pressable
              onPress={() => setShowBalance((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showBalance ? "Hide balance" : "Show balance"}
            >
              <Ionicons name={showBalance ? "eye" : "eye-off"} size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.balanceValue}>{showBalance ? formattedBalance : "••••••"}</Text>
          <View style={styles.balanceMetaRow}>
            <View style={[styles.metaBadge, { backgroundColor: netBadgeBackground }]}>
              <Ionicons name={netIcon} size={16} color={netBadgeColor} />
              <Text style={[styles.metaText, { color: netBadgeColor }]}>
                {showBalance ? netLabel : "Balance hidden"}
              </Text>
            </View>
            <Text style={styles.metaCaption}>{dayjs().format("MMMM YYYY")}</Text>
          </View>
          <View style={styles.balanceBreakdown}>
            <View style={styles.balanceColumn}>
              <Text style={styles.breakdownLabel}>Opening balance</Text>
              <Text style={styles.breakdownValue}>
                {showBalance ? formatCurrency(summary.openingBalance, currency) : "••••"}
              </Text>
            </View>
            <View style={styles.balanceColumn}>
              <Text style={styles.breakdownLabel}>Ending balance</Text>
              <Text style={styles.breakdownValue}>
                {showBalance
                  ? formatCurrency(summary.openingBalance + summary.monthNet, currency)
                  : "••••"}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.reportsLink}
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/transactions")}
          >
            <Text style={styles.reportsText}>View reports</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </Pressable>
        </View>

        <View style={[theme.components.surface, styles.monthlyReport]}>
          <View style={styles.monthlyHeader}>
            <View>
              <Text style={styles.monthlyTitle}>
                {spendingPeriod === "week" ? "This week" : "This month"}
              </Text>
              <Text style={styles.monthlyCaption}>Income vs spending</Text>
            </View>
            <View style={styles.periodSwitch}>
              {["week", "month"].map((period) => {
                const active = spendingPeriod === period;
                return (
                  <Pressable
                    key={period}
                    onPress={() => setSpendingPeriod(period as typeof spendingPeriod)}
                    style={[styles.periodPill, active && styles.periodPillActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.periodLabel, active && styles.periodLabelActive]}>
                      {period === "week" ? "Week" : "Month"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.reportTotals}>
            <View>
              <Text style={styles.reportLabel}>Total spent</Text>
              <Text style={[styles.reportValue, styles.reportValueNegative]}>
                {formattedPeriodExpenses}
              </Text>
            </View>
            <View>
              <Text style={styles.reportLabel}>Total income</Text>
              <Text style={[styles.reportValue, styles.reportValuePositive]}>
                {formattedPeriodIncome}
              </Text>
            </View>
            <View>
              <Text style={styles.reportLabel}>Trend</Text>
              <View style={styles.trendRow}>
                <Ionicons
                  name={trendPositive ? "arrow-up" : "arrow-down"}
                  size={14}
                  color={trendPositive ? theme.colors.success : theme.colors.danger}
                />
                <Text
                  style={[
                    styles.trendValue,
                    { color: trendPositive ? theme.colors.success : theme.colors.danger },
                  ]}
                >
                  {formatCurrency(trendDelta, currency, { signDisplay: "always", maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartContent}>
            <TrendLineChart incomeSeries={incomeSeries} expenseSeries={expenseSeries} style={styles.chart} />
          </ScrollView>
        </View>

        <View style={[theme.components.surface, styles.topSpendingCard]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Top spending</Text>
            <Text style={styles.sectionCaption}>
              {topSpending.totalSpent ? formatCurrency(topSpending.totalSpent, currency) : "No spend"}
            </Text>
          </View>
          {topSpending.entries.length ? (
            <View style={styles.topSpendingContent}>
              <DonutChart
                data={topSpending.entries.map((entry) => ({
                  label: entry.category,
                  value: entry.amount,
                }))}
              />
              <View style={styles.topSpendingList}>
                {topSpending.entries.map((entry) => (
                  <View key={entry.category} style={styles.topSpendingItem}>
                    <View style={styles.topSpendingItemHeader}>
                      <Text style={styles.topSpendingName}>{entry.category}</Text>
                      <Text style={styles.topSpendingAmount}>
                        {formatCurrency(entry.amount, currency)}
                      </Text>
                    </View>
                    <Text style={styles.spendingPercentage}>{entry.percentage}% of spend</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={20} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>Track a few expenses to see insights.</Text>
            </View>
          )}
        </View>

        {upcomingRecurring.length > 0 && (
          <View style={[theme.components.surface, styles.recurringCard]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Upcoming recurring</Text>
              <Text style={styles.sectionCaption}>Next {upcomingRecurring.length}</Text>
            </View>
            <View style={styles.recurringList}>
              {upcomingRecurring.map((item) => (
                <View key={item.id} style={styles.recurringRow}>
                  <View style={styles.recurringCopy}>
                    <Text style={styles.recurringNote}>{item.note}</Text>
                    <Text style={styles.recurringMeta}>
                      {dayjs(item.nextOccurrence).format("MMM D")} • {item.frequency}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => logRecurringTransaction(item.id)}
                    style={styles.recurringAction}
                    accessibilityRole="button"
                  >
                    <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.recurringActionText}>Log</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {budgetGoals.length > 0 && (
          <View style={[theme.components.surface, styles.goalsCard]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Budget goals</Text>
              <Text style={styles.sectionCaption}>Stay on track</Text>
            </View>
            <View style={styles.goalList}>
              {budgetGoals.map((goal) => {
                const progress = summarizeGoalProgress(goal, currency, transactions);
                const progressPercent = Math.round(progress.percentage * 100);
                const goalComplete = progressPercent >= 100;

                return (
                  <View key={goal.id} style={styles.goalRow}>
                    <View style={styles.goalCopy}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalMeta}>
                        {progress.label}: {progress.formatted} / {formatCurrency(goal.target, currency)}
                      </Text>
                    </View>
                    <View style={styles.goalMeter}>
                      <View
                        style={[
                          styles.goalMeterFill,
                          {
                            width: `${Math.min(100, progressPercent)}%`,
                            backgroundColor:
                              progress.direction === "save"
                                ? theme.colors.success
                                : theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.goalPercentage,
                        goalComplete && { color: theme.colors.success },
                      ]}
                    >
                      {Math.min(100, progressPercent)}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={[theme.components.surface, styles.recentCard]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <Text style={styles.sectionCaption}>Last {recentTransactions.length || 0}</Text>
          </View>
          {recentTransactions.length ? (
            <View style={styles.recentList}>
              {recentTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.recentRow}>
                  <View
                    style={[
                      styles.recentAvatar,
                      transaction.type === "income" ? styles.avatarIncome : styles.avatarExpense,
                    ]}
                  >
                    <Text style={styles.avatarText}>{transaction.category.charAt(0)}</Text>
                  </View>
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentNote}>{transaction.note}</Text>
                    <Text style={styles.recentMeta}>
                      {dayjs(transaction.date).format("ddd, D MMM")} • {transaction.category}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.recentAmount,
                      transaction.type === "income"
                        ? styles.reportValuePositive
                        : styles.reportValueNegative,
                    ]}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount, currency)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={20} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>No transactions logged yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
      gap: theme.spacing.lg,
    },
    header: {
      gap: theme.spacing.xs,
    },
    hello: {
      ...theme.typography.title,
      fontSize: 24,
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    balanceCard: {
      gap: theme.spacing.lg,
    },
    balanceHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    balanceLabel: {
      ...theme.typography.subtitle,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      fontSize: 12,
    },
    balanceValue: {
      fontSize: 36,
      fontWeight: "700",
      color: theme.colors.text,
    },
    balanceMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    metaBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    metaText: {
      fontSize: 12,
      fontWeight: "600",
    },
    metaCaption: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    balanceBreakdown: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.lg,
    },
    balanceColumn: {
      flex: 1,
      gap: 4,
    },
    breakdownLabel: {
      ...theme.typography.label,
      letterSpacing: 1.2,
    },
    breakdownValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    reportsLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 8,
    },
    reportsText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    monthlyReport: {
      gap: theme.spacing.lg,
    },
    monthlyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    monthlyTitle: {
      ...theme.typography.title,
      fontSize: 20,
    },
    monthlyCaption: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    periodSwitch: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      padding: 4,
      gap: 4,
    },
    periodPill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
    },
    periodPillActive: {
      backgroundColor: theme.colors.primary,
    },
    periodLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    periodLabelActive: {
      color: theme.colors.text,
    },
    reportTotals: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    reportLabel: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    reportValue: {
      fontSize: 18,
      fontWeight: "700",
    },
    reportValueNegative: {
      color: theme.colors.danger,
    },
    reportValuePositive: {
      color: theme.colors.success,
    },
    trendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    trendValue: {
      fontSize: 16,
      fontWeight: "600",
    },
    chartContent: {
      paddingRight: theme.spacing.lg,
    },
    chart: {
      minWidth: 320,
    },
    topSpendingCard: {
      gap: theme.spacing.lg,
    },
    topSpendingContent: {
      flexDirection: "row",
      gap: theme.spacing.lg,
      alignItems: "center",
    },
    topSpendingList: {
      flex: 1,
      gap: theme.spacing.md,
    },
    topSpendingItem: {
      gap: 4,
    },
    topSpendingItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    topSpendingName: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    topSpendingAmount: {
      ...theme.typography.subtitle,
      fontSize: 14,
      color: theme.colors.text,
    },
    spendingPercentage: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      ...theme.typography.title,
      fontSize: 20,
    },
    sectionCaption: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    emptyState: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    emptyStateText: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    recurringCard: {
      gap: theme.spacing.md,
    },
    recurringList: {
      gap: theme.spacing.md,
    },
    recurringRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    recurringCopy: {
      flex: 1,
      gap: 4,
    },
    recurringNote: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    recurringMeta: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    recurringAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    recurringActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    goalsCard: {
      gap: theme.spacing.md,
    },
    goalList: {
      gap: theme.spacing.lg,
    },
    goalRow: {
      gap: theme.spacing.sm,
    },
    goalCopy: {
      gap: 4,
    },
    goalName: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    goalMeta: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    goalMeter: {
      width: "100%",
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.border,
      overflow: "hidden",
    },
    goalMeterFill: {
      height: "100%",
      borderRadius: 999,
    },
    goalPercentage: {
      ...theme.typography.subtitle,
      fontSize: 12,
      alignSelf: "flex-end",
    },
    recentCard: {
      gap: theme.spacing.md,
    },
    recentList: {
      gap: theme.spacing.md,
    },
    recentRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    recentAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarIncome: {
      backgroundColor: `${theme.colors.success}33`,
    },
    avatarExpense: {
      backgroundColor: `${theme.colors.danger}33`,
    },
    avatarText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    recentCopy: {
      flex: 1,
      gap: 2,
    },
    recentNote: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    recentMeta: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    recentAmount: {
      fontSize: 16,
      fontWeight: "600",
      minWidth: 96,
      textAlign: "right",
    },
  });
