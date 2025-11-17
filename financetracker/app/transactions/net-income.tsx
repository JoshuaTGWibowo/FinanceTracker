import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount, getTransactionDelta } from "../../lib/transactions";

const formatCurrency = (value: number, currency: string, options?: Intl.NumberFormatOptions) => {
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

interface WeeklyBucket {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  label: string;
  income: number;
  expense: number;
  net: number;
}

const buildWeeklyBuckets = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  const buckets: { start: dayjs.Dayjs; end: dayjs.Dayjs; label: string }[] = [];
  let cursor = start.startOf("day");

  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const weekEnd = dayjs.min(cursor.add(6, "day"), end);
    buckets.push({
      start: cursor,
      end: weekEnd,
      label: `${cursor.date()}–${weekEnd.date()}`,
    });
    cursor = weekEnd.add(1, "day");
  }

  return buckets;
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

  const [selectedAccountId] = useState<string | null>(() =>
    typeof accountId === "string" && accountId.length ? accountId : null,
  );

  const periodOptions = useMemo(() => buildMonthlyPeriods(14), []);
  const resolvedPeriod = useMemo(() => {
    const key = typeof periodParam === "string" ? periodParam : undefined;
    return periodOptions.find((option) => option.key === key) ?? periodOptions[periodOptions.length - 1];
  }, [periodOptions, periodParam]);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => resolvedPeriod.key);
  const selectedPeriod = useMemo(
    () => periodOptions.find((option) => option.key === selectedPeriodKey) ?? resolvedPeriod,
    [periodOptions, resolvedPeriod, selectedPeriodKey],
  );

  const { start, end } = useMemo(() => selectedPeriod.range(), [selectedPeriod]);

  const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);
  const scopedTransactions = filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
    if (!allowedAccountIds || allowedAccountIds.size === 0) {
      return true;
    }

    const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
    const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

    return fromAllowed || toAllowed;
  });

  const withinRange = scopedTransactions.filter((transaction) => {
    const date = dayjs(transaction.date);
    return !date.isBefore(start) && !date.isAfter(end) && !transaction.excludeFromReports;
  });

  const buckets: WeeklyBucket[] = useMemo(() => {
    const base = buildWeeklyBuckets(start, end);

    return base.map((bucket) => {
      const weekly = withinRange.filter((transaction) => {
        const date = dayjs(transaction.date);
        return !date.isBefore(bucket.start) && !date.isAfter(bucket.end);
      });

      const income = weekly
        .filter((transaction) => transaction.type === "income")
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      const expense = weekly
        .filter((transaction) => transaction.type === "expense")
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      const net = weekly.reduce((acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId), 0);

      return { ...bucket, income, expense, net };
    });
  }, [end, selectedAccountId, start, withinRange]);

  const totalNet = buckets.reduce((acc, bucket) => acc + bucket.net, 0);
  const maxBarValue = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.income, bucket.expense)));

  const accountLabel = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId)?.name ?? "Selected account"
    : "All visible accounts";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close net income details"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.title}>Net income details</Text>
          <Text style={styles.subtitle}>{accountLabel}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
        >
          {periodOptions.map((option) => {
            const active = option.key === selectedPeriod.key;
            return (
              <Pressable
                key={option.key}
                style={styles.periodChip(active)}
                onPress={() => setSelectedPeriodKey(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.periodChipLabel(active)}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Total</Text>
            <View style={[styles.netBadge, totalNet >= 0 ? styles.badgePositive : styles.badgeNegative]}>
              <Ionicons
                name={totalNet >= 0 ? "trending-up" : "trending-down"}
                size={16}
                color={totalNet >= 0 ? theme.colors.success : theme.colors.danger}
              />
              <Text style={styles.netBadgeText(totalNet >= 0)}>
                {totalNet >= 0 ? "Positive net" : "Negative net"}
              </Text>
            </View>
          </View>
          <Text style={styles.summaryValue(totalNet >= 0)}>
            {formatCurrency(totalNet, currency, { signDisplay: "always" })}
          </Text>
          <Text style={styles.summaryHint}>{`${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`}</Text>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Weekly view</Text>
            <Text style={styles.sectionHint}>Tap a week to see its transactions</Text>
          </View>
          <View style={styles.chartArea}>
            <View style={styles.chartAxis} />
            <View style={styles.chartBars}>
              {buckets.map((bucket) => {
                const incomeHeight = (bucket.income / maxBarValue) * 90;
                const expenseHeight = (bucket.expense / maxBarValue) * 90;

                return (
                  <View key={bucket.label} style={styles.barGroup}>
                    <View style={styles.barWrapper}>
                      <View style={[styles.barPositive, { height: incomeHeight }]} />
                      <View style={[styles.barNegative, { height: expenseHeight }]} />
                    </View>
                    <Text style={styles.barLabel}>{bucket.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Weekly breakdown</Text>
            <Text style={styles.sectionHint}>Income, expenses, and net change per week</Text>
          </View>

          <View style={styles.weekList}>
            {buckets.map((bucket) => {
              const incomeText = formatCurrency(bucket.income, currency);
              const expenseText = formatCurrency(bucket.expense, currency);
              const netPositive = bucket.net >= 0;
              const netText = formatCurrency(bucket.net, currency, { signDisplay: "always" });

              return (
                <Pressable
                  key={`${bucket.label}-${bucket.start.toISOString()}`}
                  style={styles.weekRow}
                  onPress={() =>
                    router.push({
                      pathname: "/transactions/net-income-week",
                      params: {
                        start: bucket.start.toISOString(),
                        end: bucket.end.toISOString(),
                        accountId: selectedAccountId ?? "",
                        periodLabel: selectedPeriod.label,
                        weekLabel: bucket.label,
                      },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${bucket.label} details`}
                >
                  <View style={styles.weekMeta}>
                    <Text style={styles.weekLabel}>{bucket.label}</Text>
                    <Text style={styles.weekDates}>
                      {`${bucket.start.format("MMM D")} – ${bucket.end.format("MMM D")}`}
                    </Text>
                  </View>
                  <View style={styles.weekAmounts}>
                    <Text style={styles.weekIncome}>{incomeText}</Text>
                    <Text style={styles.weekExpense}>{expenseText}</Text>
                    <View style={styles.netChip(netPositive)}>
                      <Ionicons
                        name={netPositive ? "arrow-up" : "arrow-down"}
                        size={14}
                        color={netPositive ? theme.colors.success : theme.colors.danger}
                      />
                      <Text style={styles.netChipText(netPositive)}>{netText}</Text>
                    </View>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    headerMeta: {
      flex: 1,
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
    headerSpacer: {
      width: 40,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    periodRow: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    periodChip: (active: boolean) => ({
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: active ? `${theme.colors.primary}15` : theme.colors.surface,
      borderWidth: active ? 1 : 0,
      borderColor: active ? `${theme.colors.primary}50` : "transparent",
    }),
    periodChipLabel: (active: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: active ? theme.colors.primary : theme.colors.text,
    }),
    summaryCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: 6,
    },
    summaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.colors.textMuted,
    },
    summaryValue: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    summaryHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    netBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radii.md,
    },
    badgePositive: {
      backgroundColor: `${theme.colors.success}18`,
    },
    badgeNegative: {
      backgroundColor: `${theme.colors.danger}18`,
    },
    netBadgeText: (positive: boolean) => ({
      fontSize: 12,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    chartCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    },
    chartHeader: {
      gap: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    chartArea: {
      position: "relative",
      paddingTop: theme.spacing.md,
    },
    chartAxis: {
      position: "absolute",
      top: 70,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: `${theme.colors.textMuted}33`,
    },
    chartBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xl,
    },
    barGroup: {
      alignItems: "center",
      flex: 1,
      minWidth: 0,
    },
    barWrapper: {
      width: "100%",
      height: 140,
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    barPositive: {
      width: "52%",
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.success}cc`,
    },
    barNegative: {
      width: "52%",
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.danger}cc`,
    },
    barLabel: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    listCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    },
    listHeader: {
      gap: 2,
    },
    weekList: {
      gap: theme.spacing.sm,
    },
    weekRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}10`,
    },
    weekMeta: {
      flex: 1,
    },
    weekLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekDates: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    weekAmounts: {
      alignItems: "flex-end",
      gap: 4,
    },
    weekIncome: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.success,
    },
    weekExpense: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.danger,
    },
    netChip: (positive: boolean) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
      backgroundColor: positive ? `${theme.colors.success}18` : `${theme.colors.danger}18`,
    }),
    netChipText: (positive: boolean) => ({
      fontSize: 12,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
  });
