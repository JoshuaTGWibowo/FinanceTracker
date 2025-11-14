import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Link, useRouter } from "expo-router";

import { DonutChart } from "../../components/DonutChart";
import { SpendingBarChart, SpendingLineChart } from "../../components/SpendingCharts";
import { useAppTheme } from "../../theme";
import { BudgetGoal, useFinanceStore } from "../../lib/store";
import { filterTransactionsByAccount, getTransactionDelta, getTransactionVisualState } from "../../lib/transactions";
import { truncateWords } from "../../lib/text";

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
  accountId: string | null,
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
    const delta = getTransactionDelta(transaction, accountId);
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

const quickActions = [
  { key: "add", label: "Add expense", icon: "add-circle", destination: "/transactions/new" },
  { key: "transactions", label: "View log", icon: "receipt", destination: "/(tabs)/transactions" },
  { key: "accounts", label: "Accounts", icon: "wallet", destination: "/(tabs)/account" },
] as const;

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const transactions = useFinanceStore((state) => state.transactions);
  const profile = useFinanceStore((state) => state.profile);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const logRecurringTransaction = useFinanceStore((state) => state.logRecurringTransaction);
  const accounts = useFinanceStore((state) => state.accounts);

  const reportableTransactions = useMemo(
    () => transactions.filter((transaction) => !transaction.excludeFromReports),
    [transactions],
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => map.set(account.id, account.name));
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

  const baseCurrency = profile.currency || "USD";
  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency,
      ),
    [accounts, baseCurrency],
  );

  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const scopedTransactions = useMemo(() => {
    const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);
    return filterTransactionsByAccount(reportableTransactions, selectedAccountId).filter((transaction) => {
      if (!allowedAccountIds || allowedAccountIds.size === 0) {
        return true;
      }

      const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
      const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;
      return fromAllowed || toAllowed;
    });
  }, [reportableTransactions, selectedAccountId, visibleAccountIds]);

  const allAccountsBalance = useMemo(
    () => visibleAccounts.reduce((acc, account) => acc + account.balance, 0),
    [visibleAccounts],
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const balance = selectedAccount ? selectedAccount.balance : allAccountsBalance;

  const [overviewPeriod, setOverviewPeriod] = useState<"week" | "month">("month");
  const [overviewChart, setOverviewChart] = useState<"bar" | "line">("bar");
  const [topSpendingPeriod, setTopSpendingPeriod] = useState<"week" | "month">("month");
  const [showBalance, setShowBalance] = useState(true);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  useEffect(() => {
    if (overviewPeriod === "week" && overviewChart === "line") {
      setOverviewChart("bar");
    }
  }, [overviewChart, overviewPeriod]);

  const startOfMonth = useMemo(() => dayjs().startOf("month"), []);
  const endOfMonth = useMemo(() => dayjs().endOf("month"), []);

  const summary = useMemo(
    () =>
      scopedTransactions.reduce(
        (acc, transaction) => {
          const date = dayjs(transaction.date);
          const delta = getTransactionDelta(transaction, selectedAccountId);

          if (date.isBefore(startOfMonth)) {
            acc.openingBalance += delta;
          }

          if (!date.isBefore(startOfMonth) && !date.isAfter(endOfMonth)) {
            if (transaction.type === "income") {
              acc.income += transaction.amount;
            } else if (transaction.type === "expense") {
              acc.expense += transaction.amount;
            }
            acc.monthNet += delta;
          }

          return acc;
        },
        { income: 0, expense: 0, openingBalance: 0, monthNet: 0 },
      ),
    [endOfMonth, scopedTransactions, selectedAccountId, startOfMonth],
  );

  const {
    periodExpense,
    periodDailySpending,
    monthlyComparison,
    previousExpense,
    monthlyLineSeries,
  } = useMemo(() => {
    const today = dayjs();
    const periodStart = overviewPeriod === "week" ? today.startOf("week") : today.startOf("month");
    const periodEnd = overviewPeriod === "week" ? today.endOf("week") : today.endOf("month");

    const filtered = scopedTransactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return !date.isBefore(periodStart) && !date.isAfter(periodEnd);
    });

    const totals = filtered.reduce(
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

    const dayCount = periodEnd.diff(periodStart, "day") + 1;
    const periodDailySpending = Array.from({ length: dayCount }).map((_, index) => {
      const day = periodStart.add(index, "day");
      const value = filtered
        .filter((transaction) => transaction.type === "expense" && dayjs(transaction.date).isSame(day, "day"))
        .reduce((acc, transaction) => acc + transaction.amount, 0);

      if (overviewPeriod === "week") {
        return {
          label: day.format("dd"),
          value,
          hint: day.format("ddd"),
        };
      }

      const label = index === 0 ? "1" : index === dayCount - 1 ? String(dayCount) : "";
      return {
        label,
        value,
        hint: String(index + 1),
      };
    });

    const previousPeriodStart =
      overviewPeriod === "week" ? periodStart.subtract(1, "week") : periodStart.subtract(1, "month");
    const previousPeriodEnd =
      overviewPeriod === "week" ? previousPeriodStart.endOf("week") : previousPeriodStart.endOf("month");

    const previousExpense = scopedTransactions.reduce((acc, transaction) => {
      if (transaction.type !== "expense") {
        return acc;
      }
      const date = dayjs(transaction.date);
      if (!date.isBefore(previousPeriodStart) && !date.isAfter(previousPeriodEnd)) {
        return acc + transaction.amount;
      }
      return acc;
    }, 0);

    const monthlyComparison =
      overviewPeriod === "month"
        ? Array.from({ length: 5 }).map((_, index) => {
            const offset = 4 - index;
            const target = today.subtract(offset, "month");
            const start = target.startOf("month");
            const end = target.endOf("month");
            const spent = scopedTransactions.reduce((acc, transaction) => {
              if (transaction.type !== "expense") {
                return acc;
              }
              const date = dayjs(transaction.date);
              if (!date.isBefore(start) && !date.isAfter(end)) {
                return acc + transaction.amount;
              }
              return acc;
            }, 0);

            return {
              label: target.format("MMM"),
              value: spent,
              hint: target.format("MMM"),
            };
          })
        : [];

    const monthStart = today.startOf("month");
    const monthEnd = today.endOf("month");
    const daysInMonth = monthEnd.diff(monthStart, "day") + 1;
    const previousMonthStart = monthStart.subtract(1, "month");
    const previousMonthEnd = previousMonthStart.endOf("month");
    const previousMonthDayCount = previousMonthEnd.diff(previousMonthStart, "day") + 1;

    const buildMonthlyPoint = (index: number, value: number) => ({
      label: index === 0 ? "1" : index === daysInMonth - 1 ? String(daysInMonth) : "",
      value,
      hint: String(index + 1),
    });

    const currentMonthDaily = Array.from({ length: daysInMonth }).map((_, index) => {
      const day = monthStart.add(index, "day");
      const spent = scopedTransactions
        .filter((transaction) => transaction.type === "expense" && dayjs(transaction.date).isSame(day, "day"))
        .reduce((acc, transaction) => acc + transaction.amount, 0);

      return buildMonthlyPoint(index, spent);
    });

    const previousMonthValues = Array.from({ length: previousMonthDayCount }).map((_, index) => {
      const day = previousMonthStart.add(index, "day");
      return scopedTransactions
        .filter((transaction) => transaction.type === "expense" && dayjs(transaction.date).isSame(day, "day"))
        .reduce((acc, transaction) => acc + transaction.amount, 0);
    });

    const lastPreviousValue = previousMonthValues.length
      ? previousMonthValues[previousMonthValues.length - 1]
      : 0;

    const previousMonthDaily = Array.from({ length: daysInMonth }).map((_, index) => {
      const value = index < previousMonthDayCount ? previousMonthValues[index] : lastPreviousValue;
      return buildMonthlyPoint(index, value);
    });

    return {
      periodExpense: totals.expense,
      periodDailySpending,
      monthlyComparison,
      previousExpense,
      monthlyLineSeries: {
        current: currentMonthDaily,
        previous: previousMonthDaily,
      },
    };
  }, [overviewPeriod, scopedTransactions]);

  const topSpending = useMemo(() => {
    const today = dayjs();
    const periodStart = topSpendingPeriod === "week" ? today.startOf("week") : today.startOf("month");
    const periodEnd = topSpendingPeriod === "week" ? today.endOf("week") : today.endOf("month");

    const filtered = scopedTransactions.filter((transaction) => {
      if (transaction.type !== "expense") {
        return false;
      }
      const date = dayjs(transaction.date);
      return !date.isBefore(periodStart) && !date.isAfter(periodEnd);
    });

    const totalsByCategory = filtered.reduce((acc, transaction) => {
      const previous = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, previous + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const totalSpent = filtered.reduce((acc, transaction) => acc + transaction.amount, 0);

    const sorted = Array.from(totalsByCategory.entries()).sort((a, b) => b[1] - a[1]);
    const topThree = sorted.slice(0, 3);
    const remaining = sorted.slice(3);
    const othersTotal = remaining.reduce((acc, [, amount]) => acc + amount, 0);

    const entries = topThree.map(([category, amount]) => ({
      key: category,
      label: category,
      amount,
      percentage: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
    }));

    if (othersTotal > 0) {
      entries.push({
        key: "__others__",
        label: "Others",
        amount: othersTotal,
        percentage: totalSpent ? Math.round((othersTotal / totalSpent) * 100) : 0,
      });
    }

    return { entries, totalSpent };
  }, [scopedTransactions, topSpendingPeriod]);

  const donutColors = useMemo(
    () => [
      theme.colors.primary,
      theme.colors.accent,
      theme.colors.success,
      theme.colors.danger,
      theme.colors.primaryMuted,
    ],
    [theme],
  );

  const topSpendingEntries = useMemo(
    () =>
      topSpending.entries.map((entry, index) => ({
        ...entry,
        color: donutColors[index % donutColors.length],
      })),
    [donutColors, topSpending.entries],
  );

  const currency = selectedAccount?.currency || baseCurrency;
  const formattedBalance = formatCurrency(balance, currency);
  const formattedPeriodExpenses = formatCurrency(periodExpense, currency);

  const netChangeThisMonth = summary.income - summary.expense;
  const netIsPositive = netChangeThisMonth >= 0;
  const netBadgeColor = netIsPositive ? theme.colors.success : theme.colors.danger;
  const netBadgeBackground = netIsPositive ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)";
  const netIcon = netIsPositive ? "trending-up" : "trending-down";
  const netLabel = `${formatCurrency(netChangeThisMonth, currency, { signDisplay: "always" })} this month`;

  const recentSourceTransactions = useMemo(
    () => filterTransactionsByAccount(transactions, selectedAccountId),
    [selectedAccountId, transactions],
  );

  const recentTransactions = useMemo(
    () =>
      [...recentSourceTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [recentSourceTransactions],
  );

  const trendDelta = previousExpense - periodExpense;
  const spentLess = trendDelta >= 0;

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
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <LinearGradient colors={theme.gradients.hero} style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroTitleBlock}>
                <Text style={styles.eyebrow}>Total balance</Text>
                <Text style={styles.balanceValue}>{showBalance ? formattedBalance : "••••••"}</Text>
              </View>
              <Pressable
                onPress={() => setShowBalance((prev) => !prev)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              >
                <Ionicons name={showBalance ? "eye" : "eye-off"} size={18} color={theme.colors.text} />
              </Pressable>
            </View>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.eyebrow}>Income</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(summary.income, currency)}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.eyebrow}>Spend</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(summary.expense, currency)}</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: netBadgeBackground }]}>
                <Ionicons name={netIcon} size={16} color={netBadgeColor} />
                <Text style={[styles.heroBadgeText, { color: netBadgeColor }]}>
                  {showBalance ? netLabel : "Hidden"}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.accountSwitchRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountChipRow}>
              <Pressable
                onPress={() => setSelectedAccountId(null)}
                style={[styles.accountChip, !selectedAccountId && styles.accountChipActive]}
              >
                <Text style={styles.accountChipLabel}>All accounts</Text>
                <Text style={styles.accountChipValue}>{formatCurrency(allAccountsBalance, baseCurrency)}</Text>
              </Pressable>
              {accounts.map((account) => {
                const active = selectedAccountId === account.id;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={[styles.accountChip, active && styles.accountChipActive, account.isArchived && styles.accountChipArchived]}
                  >
                    <Text style={styles.accountChipLabel}>{account.name}</Text>
                    <Text style={styles.accountChipValue}>
                      {formatCurrency(account.balance, account.currency || baseCurrency)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.actionRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.destination)}
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              >
                <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.colors.text} />
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Spending focus</Text>
              <Text style={styles.sectionSubtitle}>Monitor cash burn and cadence</Text>
            </View>
            <View style={styles.segmentedControl}>
              {(["week", "month"] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => setOverviewPeriod(period)}
                  style={[styles.segmentButton, overviewPeriod === period && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentLabel, overviewPeriod === period && styles.segmentLabelActive]}>
                    {period === "week" ? "7d" : "30d"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.chartToggleRow}>
            {(["bar", "line"] as const).map((chartType) => (
              <Pressable
                key={chartType}
                onPress={() => setOverviewChart(chartType)}
                disabled={overviewPeriod === "week" && chartType === "line"}
                style={[styles.chartToggle, overviewChart === chartType && styles.chartToggleActive]}
              >
                <Ionicons
                  name={chartType === "bar" ? "stats-chart" : "analytics"}
                  size={16}
                  color={overviewChart === chartType ? theme.colors.text : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.chartToggleLabel,
                    overviewChart === chartType && styles.chartToggleLabelActive,
                  ]}
                >
                  {chartType === "bar" ? "Bars" : "Lines"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chartCard}>
            {overviewChart === "bar" ? (
              <SpendingBarChart
                data={periodDailySpending}
                formatValue={(value) => formatCurrency(value, currency)}
                style={styles.chart}
                onActiveChange={() => {}}
              />
            ) : (
              <SpendingLineChart
                data={monthlyLineSeries.current}
                comparison={monthlyLineSeries.previous}
                formatValue={(value) => formatCurrency(value, currency)}
                style={styles.chart}
                onActiveChange={() => {}}
              />
            )}
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.eyebrow}>Spent this {overviewPeriod === "week" ? "week" : "month"}</Text>
              <Text style={styles.metricValue}>{formattedPeriodExpenses}</Text>
              <View style={styles.metricBadge}>
                <Ionicons name={spentLess ? "sparkles" : "warning"} size={14} color={theme.colors.text} />
                <Text style={styles.metricBadgeText}>
                  {spentLess
                    ? `${formatCurrency(trendDelta, currency, { signDisplay: "always" })} vs last period`
                    : `${formatCurrency(Math.abs(trendDelta), currency)} more than last period`}
                </Text>
              </View>
            </View>
            {monthlyComparison.length > 0 && (
              <View style={styles.metricCard}>
                <Text style={styles.eyebrow}>5 month trend</Text>
                <SpendingBarChart
                  data={monthlyComparison}
                  formatValue={(value) => formatCurrency(value, currency)}
                  style={styles.miniChart}
                  onActiveChange={() => {}}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Top categories</Text>
              <Text style={styles.sectionSubtitle}>Where your cash is flowing</Text>
            </View>
            <View style={styles.segmentedControl}>
              {(["week", "month"] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => setTopSpendingPeriod(period)}
                  style={[styles.segmentButton, topSpendingPeriod === period && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentLabel, topSpendingPeriod === period && styles.segmentLabelActive]}>
                    {period === "week" ? "7d" : "30d"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {topSpendingEntries.length > 0 ? (
            <View style={styles.topSpendingContent}>
              <DonutChart data={topSpendingEntries} />
              <View style={styles.topSpendingList}>
                {topSpendingEntries.map((entry) => {
                  const isCategory = entry.key !== "__others__";
                  const content = (
                    <View style={styles.topSpendingItem}>
                      <View style={[styles.colorDot, { backgroundColor: entry.color }]} />
                      <View style={styles.topSpendingCopy}>
                        <Text style={styles.topSpendingLabel}>{entry.label}</Text>
                        <Text style={styles.topSpendingMeta}>{entry.percentage}% of spend</Text>
                      </View>
                      <Text style={styles.topSpendingValue}>{formatCurrency(entry.amount, currency)}</Text>
                    </View>
                  );

                  if (!isCategory) {
                    return (
                      <View key={entry.key} style={styles.topSpendingRowStatic}>
                        {content}
                      </View>
                    );
                  }

                  return (
                    <Link
                      key={entry.key}
                      href={{ pathname: "/(tabs)/transactions", params: { category: entry.key } }}
                      asChild
                    >
                      <Pressable style={({ pressed }) => [styles.topSpendingRowInteractive, pressed && styles.topSpendingRowPressed]}>
                        {content}
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={20} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>Track a few expenses to unlock insights.</Text>
            </View>
          )}
        </View>

        {budgetGoals.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Budget goals</Text>
                <Text style={styles.sectionSubtitle}>Micro targets keep you honest</Text>
              </View>
            </View>
            <View style={styles.goalList}>
              {budgetGoals.map((goal) => {
                const progress = summarizeGoalProgress(goal, currency, scopedTransactions, selectedAccountId);
                const progressPercent = Math.round(progress.percentage * 100);
                const goalComplete = progressPercent >= 100;

                return (
                  <View key={goal.id} style={styles.goalCard}>
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
                            backgroundColor: progress.direction === "save" ? theme.colors.success : theme.colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.goalPercentage, goalComplete && { color: theme.colors.success }]}>
                      {progressPercent}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {upcomingRecurring.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Upcoming autopay</Text>
                <Text style={styles.sectionSubtitle}>Prep for the next few debits</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Next {upcomingRecurring.length}</Text>
            </View>
            <View style={styles.recurringList}>
              {upcomingRecurring.map((item) => (
                <View key={item.id} style={styles.recurringRow}>
                  <View style={styles.recurringCopy}>
                    <Text style={styles.recurringCategory}>{item.category}</Text>
                    {item.note ? (
                      <Text style={styles.recurringNote} numberOfLines={2}>
                        {truncateWords(item.note, 10)}
                      </Text>
                    ) : null}
                    <Text style={styles.recurringMeta}>
                      {dayjs(item.nextOccurrence).format("MMM D")} • {` ${item.frequency.charAt(0).toUpperCase()}${item.frequency.slice(1)}`}
                    </Text>
                  </View>
                  <Pressable onPress={() => logRecurringTransaction(item.id)} style={styles.recurringAction}>
                    <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.recurringActionText}>Log</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Latest activity</Text>
              <Text style={styles.sectionSubtitle}>Most recent five transactions</Text>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/transactions")}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.timeline}>
            {recentTransactions.map((transaction, index) => {
              const visualState = getTransactionVisualState(transaction);
              const isLast = index === recentTransactions.length - 1;
              return (
                <View key={transaction.id} style={styles.timelineRow}>
                  <View style={styles.timelineIndicator}>
                    <View style={styles.timelineBullet} />
                    {!isLast && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={styles.timelineCard}>
                    <Text style={styles.timelineTitle}>{transaction.note || transaction.category}</Text>
                    <Text style={styles.timelineMeta}>
                      {dayjs(transaction.date).format("MMM D")} {transaction.accountId ? `• ${resolveAccountName(transaction.accountId)}` : ""}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.timelineAmount,
                      visualState === "income"
                        ? styles.timelineIncome
                        : visualState === "expense"
                          ? styles.timelineExpense
                          : styles.timelineTransfer,
                    ]}
                  >
                    {formatCurrency(transaction.amount, currency)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingBottom: theme.spacing.xxl + insets.bottom + 48,
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.xl,
    },
    heroSection: {
      gap: theme.spacing.lg,
    },
    heroCard: {
      borderRadius: theme.radii.lg,
      padding: theme.spacing.xl,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.lg,
    },
    heroTitleBlock: {
      gap: 6,
    },
    balanceValue: {
      fontSize: 34,
      fontWeight: "700",
      color: theme.colors.text,
      letterSpacing: 0.4,
    },
    eyebrow: {
      ...theme.typography.label,
      fontSize: 12,
    },
    heroStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.lg,
    },
    heroStat: {
      flex: 1,
      gap: 4,
    },
    heroStatValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
    },
    heroBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    iconButtonPressed: {
      opacity: 0.7,
    },
    accountSwitchRow: {
      marginTop: -theme.spacing.sm,
    },
    accountChipRow: {
      gap: theme.spacing.sm,
      paddingRight: theme.spacing.md,
    },
    accountChip: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.backgroundMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      gap: 4,
      minWidth: 150,
    },
    accountChipActive: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderColor: theme.colors.primary,
    },
    accountChipArchived: {
      opacity: 0.5,
    },
    accountChipLabel: {
      ...theme.typography.subtitle,
      fontSize: 13,
      textTransform: "none",
      letterSpacing: 0,
    },
    accountChipValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    actionRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    actionButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    actionButtonPressed: {
      opacity: 0.7,
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sectionCard: {
      ...theme.components.card,
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      ...theme.typography.title,
      fontSize: 20,
    },
    sectionSubtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    segmentedControl: {
      flexDirection: "row",
      borderRadius: theme.radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      overflow: "hidden",
    },
    segmentButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    segmentButtonActive: {
      backgroundColor: theme.colors.backgroundMuted,
    },
    segmentLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    segmentLabelActive: {
      color: theme.colors.text,
    },
    chartToggleRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
    },
    chartToggle: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    chartToggleActive: {
      backgroundColor: theme.colors.backgroundMuted,
      borderColor: theme.colors.primary,
    },
    chartToggleLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    chartToggleLabelActive: {
      color: theme.colors.text,
    },
    chartCard: {
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.backgroundMuted,
      padding: theme.spacing.lg,
    },
    chart: {
      width: "100%",
    },
    metricRow: {
      flexDirection: "row",
      gap: theme.spacing.lg,
      flexWrap: "wrap",
    },
    metricCard: {
      flex: 1,
      minWidth: 160,
      backgroundColor: theme.colors.backgroundMuted,
      borderRadius: theme.radii.md,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    metricBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metricBadgeText: {
      fontSize: 13,
      color: theme.colors.text,
    },
    miniChart: {
      width: "100%",
      height: 120,
    },
    topSpendingContent: {
      flexDirection: "row",
      gap: theme.spacing.lg,
      flexWrap: "wrap",
    },
    topSpendingList: {
      flex: 1,
      gap: theme.spacing.sm,
      minWidth: 200,
    },
    topSpendingItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    topSpendingCopy: {
      flex: 1,
      gap: 2,
    },
    topSpendingLabel: {
      fontWeight: "600",
      color: theme.colors.text,
    },
    topSpendingMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    topSpendingValue: {
      fontWeight: "600",
      color: theme.colors.text,
    },
    topSpendingRowStatic: {
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    topSpendingRowInteractive: {
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    topSpendingRowPressed: {
      opacity: 0.7,
    },
    emptyState: {
      alignItems: "center",
      gap: 6,
      paddingVertical: theme.spacing.lg,
    },
    emptyStateText: {
      color: theme.colors.textMuted,
    },
    goalList: {
      gap: theme.spacing.lg,
    },
    goalCard: {
      backgroundColor: theme.colors.backgroundMuted,
      borderRadius: theme.radii.md,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    goalCopy: {
      gap: 4,
    },
    goalName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    goalMeta: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    goalMeter: {
      width: "100%",
      height: 6,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.06)",
      overflow: "hidden",
    },
    goalMeterFill: {
      height: "100%",
      borderRadius: 4,
    },
    goalPercentage: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: "600",
    },
    recurringList: {
      gap: theme.spacing.md,
    },
    recurringRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    recurringCopy: {
      flex: 1,
      gap: 4,
    },
    recurringCategory: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    recurringNote: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    recurringMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    recurringAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.primary,
    },
    recurringActionText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    timeline: {
      gap: theme.spacing.md,
    },
    timelineRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
    },
    timelineIndicator: {
      width: 24,
      alignItems: "center",
    },
    timelineBullet: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    timelineConnector: {
      width: 2,
      flex: 1,
      backgroundColor: theme.colors.outline,
      marginTop: 2,
    },
    timelineCard: {
      flex: 1,
      backgroundColor: theme.colors.backgroundMuted,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      gap: 4,
    },
    timelineTitle: {
      fontWeight: "600",
      color: theme.colors.text,
    },
    timelineMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    timelineAmount: {
      fontWeight: "700",
      fontSize: 15,
      minWidth: 90,
      textAlign: "right",
    },
    timelineIncome: {
      color: theme.colors.success,
    },
    timelineExpense: {
      color: theme.colors.danger,
    },
    timelineTransfer: {
      color: theme.colors.accent,
    },
    linkText: {
      color: theme.colors.accent,
      fontWeight: "600",
    },
  });
