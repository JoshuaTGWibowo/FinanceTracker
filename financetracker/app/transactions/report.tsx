import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { getTransactionDelta } from "../../lib/transactions";

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

export default function PeriodReportModal() {
  const router = useRouter();
  const { period } = useLocalSearchParams<{ period?: string }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const insights = useMemo(() => {
    const periodOptions = buildMonthlyPeriods();
    const selected =
      periodOptions.find((option) => option.key === period) || periodOptions[periodOptions.length - 1];
    const { start, end } = selected.range();

    const scoped = transactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return !date.isBefore(start) && !date.isAfter(end);
    });

    const reportable = scoped.filter((transaction) => !transaction.excludeFromReports);
    const incomeTotal = reportable
      .filter((transaction) => transaction.type === "income")
      .reduce((acc, transaction) => acc + transaction.amount, 0);
    const expenseTransactions = reportable.filter((transaction) => transaction.type === "expense");
    const expenseTotal = expenseTransactions.reduce((acc, transaction) => acc + transaction.amount, 0);
    const netChange = reportable.reduce(
      (acc, transaction) => acc + getTransactionDelta(transaction, null),
      0,
    );

    const openingBalance = transactions
      .filter((transaction) => !transaction.excludeFromReports)
      .reduce((acc, transaction) => {
        const date = dayjs(transaction.date);
        if (date.isBefore(start)) {
          return acc + getTransactionDelta(transaction, null);
        }
        return acc;
      }, 0);

    const closingBalance = openingBalance + netChange;

    const activeDaysSet = new Set(
      reportable.map((transaction) => dayjs(transaction.date).format("YYYY-MM-DD")),
    );
    const activeDays = activeDaysSet.size;
    const avgDailySpend = activeDays ? expenseTotal / activeDays : 0;
    const avgExpense = expenseTransactions.length
      ? expenseTotal / expenseTransactions.length
      : 0;

    const categoryMap = expenseTransactions.reduce((acc, transaction) => {
      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const topCategoryEntry = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const topCategoryName = topCategoryEntry ? topCategoryEntry[0] : "No expenses";
    const topCategoryPercent = topCategoryEntry && expenseTotal
      ? Math.round((topCategoryEntry[1] / expenseTotal) * 100)
      : 0;

    const dayCounts = new Map<string, number>();
    const daySpend = new Map<string, number>();
    scoped.forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    });
    expenseTransactions.forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      daySpend.set(key, (daySpend.get(key) ?? 0) + transaction.amount);
    });

    const busiestDay = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const spendiestDay = Array.from(daySpend.entries()).sort((a, b) => b[1] - a[1])[0];

    const savingsRate = incomeTotal ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : null;

    const totalTransactions = scoped.length;

    return {
      label: selected.label,
      rangeLabel: `${start.format("MMM D")} – ${end.format("MMM D")}`,
      openingBalance,
      closingBalance,
      netChange,
      incomeTotal,
      expenseTotal,
      avgDailySpend,
      avgExpense,
      activeDays,
      activeDaysLabel: activeDays === 1 ? "1 active day" : `${activeDays} active days`,
      expenseTransactionsCount: expenseTransactions.length,
      topCategoryName,
      topCategoryPercent,
      busiestDayLabel: busiestDay ? dayjs(busiestDay[0]).format("MMM D") : "—",
      busiestDayCount: busiestDay ? busiestDay[1] : 0,
      spendiestDayLabel: spendiestDay ? dayjs(spendiestDay[0]).format("MMM D") : "—",
      spendiestDayAmount: spendiestDay ? spendiestDay[1] : 0,
      totalTransactions,
      savingsRate,
    };
  }, [period, transactions]);

  const summaryCards = [
    {
      key: "net",
      title: "Net change",
      value: formatCurrency(insights.netChange, currency),
      subtitle: `vs opening ${formatCurrency(insights.openingBalance, currency)}`,
    },
    {
      key: "daily",
      title: "Avg daily spend",
      value: formatCurrency(insights.avgDailySpend, currency, { maximumFractionDigits: 0 }),
      subtitle: insights.activeDays ? insights.activeDaysLabel : "No activity",
    },
    {
      key: "avg-expense",
      title: "Avg expense",
      value: formatCurrency(insights.avgExpense, currency),
      subtitle: `${insights.expenseTransactionsCount} transactions`,
    },
    {
      key: "top",
      title: "Top category",
      value: insights.topCategoryName,
      subtitle: insights.topCategoryPercent ? `${insights.topCategoryPercent}% of spend` : "—",
    },
  ];

  const details = [
    {
      label: "Busiest day",
      value: insights.busiestDayLabel,
      helper: insights.busiestDayCount
        ? `${insights.busiestDayCount} transactions`
        : "No transactions",
    },
    {
      label: "Most spent",
      value: insights.spendiestDayLabel,
      helper: insights.spendiestDayAmount
        ? formatCurrency(insights.spendiestDayAmount, currency)
        : "No expenses",
    },
    {
      label: "Total transactions",
      value: String(insights.totalTransactions),
      helper: "All types",
    },
    {
      label: "Savings rate",
      value:
        insights.savingsRate !== null ? `${insights.savingsRate.toFixed(1)}%` : "—",
      helper:
        insights.savingsRate !== null
          ? `${formatCurrency(insights.incomeTotal - insights.expenseTotal, currency)} saved`
          : "Add income to calculate",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button">
          <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Period insights</Text>
          <Text style={styles.subtitle}>
            {insights.label} • {insights.rangeLabel}
          </Text>
        </View>
        <View style={styles.iconPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cardGrid}>
          {summaryCards.map((card) => (
            <View key={card.key} style={styles.card}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardHelper}>{card.subtitle}</Text>
            </View>
          ))}
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>More insights</Text>
          {details.map((detail, index) => (
            <View key={detail.label} style={[styles.detailRow, index > 0 && styles.detailDivider]}>
              <View>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailHelper}>{detail.helper}</Text>
              </View>
              <Text style={styles.detailValue}>{detail.value}</Text>
            </View>
          ))}
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    iconPlaceholder: {
      width: 40,
      height: 40,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    content: {
      padding: 16,
      paddingBottom: 48,
      gap: 16,
    },
    cardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    card: {
      flexBasis: "48%",
      flexGrow: 1,
      minWidth: 150,
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 16,
    },
    cardTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    cardValue: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    cardHelper: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 6,
    },
    detailsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 16,
    },
    detailsTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    detailDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: 16,
      marginTop: 8,
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    detailHelper: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    detailValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
  });
