import { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount, getTransactionDelta } from "../../lib/transactions";
import { DonutChart, type DonutDatum } from "../../components/DonutChart";

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

interface ChartEntry extends DonutDatum {
  percentage: number;
  color: string;
}

export default function PeriodReportModal() {
  const router = useRouter();
  const theme = useAppTheme();
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency);
  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const { period: periodParam, accountId: accountParam } = useLocalSearchParams<{
    period?: string | string[];
    accountId?: string | string[];
  }>();

  const resolvedPeriodKey = Array.isArray(periodParam) ? periodParam[0] : periodParam;
  const selectedPeriod =
    periodOptions.find((option) => option.key === resolvedPeriodKey) ??
    periodOptions[periodOptions.length - 1];
  const periodRange = useMemo(() => selectedPeriod.range(), [selectedPeriod]);
  const { start, end } = periodRange;

  const resolvedAccountParam = Array.isArray(accountParam) ? accountParam[0] : accountParam;
  const selectedAccountId = resolvedAccountParam && resolvedAccountParam.length ? resolvedAccountParam : null;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const accountLabel = selectedAccount ? selectedAccount.name : "All accounts";

  const baseCurrency = currency || "USD";

  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency,
      ),
    [accounts, baseCurrency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);
  const palette = useMemo(
    () => [
      theme.colors.primary,
      theme.colors.accent,
      theme.colors.success,
      theme.colors.danger,
      theme.colors.primaryMuted,
    ],
    [theme.colors],
  );

  const report = useMemo(() => {
    const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);
    const scopedTransactions = filterTransactionsByAccount(transactions, selectedAccountId).filter(
      (transaction) => {
        if (!allowedAccountIds || allowedAccountIds.size === 0) {
          return true;
        }

        const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
        const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;
        return fromAllowed || toAllowed;
      },
    );

    const periodTransactions = scopedTransactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return !date.isBefore(start) && !date.isAfter(end);
    });

    const reportable = periodTransactions.filter((transaction) => !transaction.excludeFromReports);

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

    let openingBalance = 0;
    scopedTransactions
      .filter((transaction) => !transaction.excludeFromReports)
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
      .forEach((transaction) => {
        if (dayjs(transaction.date).isBefore(start)) {
          openingBalance += getTransactionDelta(transaction, selectedAccountId);
        }
      });
    const closingBalance = openingBalance + netChange;

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    reportable.forEach((transaction) => {
      if (transaction.type === "income") {
        incomeMap.set(transaction.category, (incomeMap.get(transaction.category) ?? 0) + transaction.amount);
      } else if (transaction.type === "expense") {
        expenseMap.set(transaction.category, (expenseMap.get(transaction.category) ?? 0) + transaction.amount);
      }
    });

    const buildChartData = (entries: [string, number][], total: number): ChartEntry[] =>
      entries.map(([label, amount], index) => ({
        label,
        value: amount,
        color: palette[index % palette.length],
        percentage: total ? Math.round((amount / total) * 100) : 0,
      }));

    return {
      openingBalance,
      closingBalance,
      net: netChange,
      income: totals.income,
      expense: totals.expense,
      incomeCategories: buildChartData(
        Array.from(incomeMap.entries()).sort((a, b) => b[1] - a[1]),
        totals.income,
      ),
      expenseCategories: buildChartData(
        Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]),
        totals.expense,
      ),
    };
  }, [end, palette, selectedAccountId, start, transactions, visibleAccountIds]);

  const periodLabel = selectedPeriod.label;
  const periodRangeLabel = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderCategoryList = (entries: ChartEntry[]) => {
    if (!entries.length) {
      return <Text style={styles.emptyCategoryText}>Not enough data</Text>;
    }

    return entries.slice(0, 4).map((entry) => (
      <View key={entry.label} style={styles.categoryRow}>
        <View style={styles.categoryLabelWrapper}>
          <View style={[styles.categoryDot, { backgroundColor: entry.color }]} />
          <Text style={styles.categoryName} numberOfLines={1}>
            {entry.label}
          </Text>
        </View>
        <View style={styles.categoryMetrics}>
          <Text style={styles.categoryAmount}>{formatCurrency(entry.value, baseCurrency)}</Text>
          <Text style={styles.categoryPercent}>{entry.percentage}%</Text>
        </View>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.modalContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button">
            <Ionicons name="close" size={20} color={theme.colors.text} />
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>Balance</Text>
            <Text style={styles.headerAccount}>{accountLabel}</Text>
          </View>
          <View style={styles.periodChip}>
            <Text style={styles.periodChipText}>{periodLabel}</Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Opening balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(report.openingBalance, baseCurrency)}</Text>
          </View>
          <View>
            <Text style={styles.balanceLabel}>Ending balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(report.closingBalance, baseCurrency)}</Text>
          </View>
        </View>

        <View style={styles.periodRange}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.periodRangeText}>{periodRangeLabel}</Text>
        </View>

        <View style={styles.netCard}>
          <View style={styles.netHeader}>
            <View>
              <Text style={styles.netTitle}>Net Income</Text>
              <Text style={styles.netSubtitle}>For {periodLabel.toLowerCase()}</Text>
            </View>
            <Text
              style={[
                styles.netValue,
                { color: report.net > 0 ? theme.colors.success : report.net < 0 ? theme.colors.danger : theme.colors.text },
              ]}
            >
              {formatCurrency(report.net, baseCurrency)}
            </Text>
          </View>
          <View style={styles.netBreakdown}>
            <View style={styles.netColumn}>
              <Text style={styles.netLabel}>Income</Text>
              <Text style={[styles.netAmount, { color: theme.colors.success }]}>
                {formatCurrency(report.income, baseCurrency)}
              </Text>
            </View>
            <View style={styles.netColumn}>
              <Text style={styles.netLabel}>Expenses</Text>
              <Text style={[styles.netAmount, { color: theme.colors.danger }]}>
                {formatCurrency(report.expense, baseCurrency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>Category report</Text>
            <Text style={styles.categorySubtitle}>Overview of income and spend</Text>
          </View>
          <View style={styles.categoryGrid}>
            <View style={styles.categoryColumn}>
              <Text style={styles.categorySectionLabel}>Income</Text>
              <DonutChart
                data={report.incomeCategories}
                centerLabel="Income"
                formatCenterValue={(value) => formatCurrency(value, baseCurrency, { maximumFractionDigits: 0 })}
              />
              <View style={styles.categoryList}>{renderCategoryList(report.incomeCategories)}</View>
            </View>
            <View style={styles.categoryColumn}>
              <Text style={styles.categorySectionLabel}>Expense</Text>
              <DonutChart
                data={report.expenseCategories}
                centerLabel="Expense"
                formatCenterValue={(value) => formatCurrency(value, baseCurrency, { maximumFractionDigits: 0 })}
              />
              <View style={styles.categoryList}>{renderCategoryList(report.expenseCategories)}</View>
            </View>
          </View>
          <Pressable
            style={styles.categoryAction}
            accessibilityRole="button"
            onPress={() => {}}
          >
            <Text style={styles.categoryActionText}>See report by categories</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    closeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    closeText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    headerCenter: {
      alignItems: "center",
      gap: 2,
    },
    headerLabel: {
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: theme.colors.textMuted,
    },
    headerAccount: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    periodChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    periodChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    balanceCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    balanceLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      color: theme.colors.textMuted,
      marginBottom: 6,
    },
    balanceValue: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodRange: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      marginBottom: 24,
    },
    periodRangeText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    netCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      gap: 16,
    },
    netHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    netTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    netSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "capitalize",
    },
    netValue: {
      fontSize: 24,
      fontWeight: "700",
    },
    netBreakdown: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 16,
    },
    netColumn: {
      flex: 1,
      gap: 4,
    },
    netLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    netAmount: {
      fontSize: 18,
      fontWeight: "700",
    },
    categoryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      gap: 16,
    },
    categoryHeader: {
      gap: 4,
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    categorySubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    categoryGrid: {
      flexDirection: "row",
      gap: 16,
      flexWrap: "wrap",
    },
    categoryColumn: {
      flex: 1,
      minWidth: 180,
      alignItems: "center",
      gap: 12,
    },
    categorySectionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    categoryList: {
      alignSelf: "stretch",
      gap: 8,
    },
    categoryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    categoryLabelWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    categoryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    categoryName: {
      fontSize: 13,
      color: theme.colors.text,
      flex: 1,
    },
    categoryMetrics: {
      alignItems: "flex-end",
      gap: 2,
    },
    categoryAmount: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    categoryPercent: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    emptyCategoryText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    categoryAction: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryActionText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });
