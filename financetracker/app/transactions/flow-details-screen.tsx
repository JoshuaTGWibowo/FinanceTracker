import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import PieChart, { CategorySlice, chartPalette } from "../../components/CategoryPieChart";
import { buildMonthlyPeriods } from "../../lib/periods";
import { useFinanceStore } from "../../lib/store";
import { filterTransactionsByAccount } from "../../lib/transactions";
import { useAppTheme, type Theme } from "../../theme";

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

interface PeriodParam {
  period?: string;
  accountId?: string;
}

type FlowType = "income" | "expense";

export const createFlowDetailsScreen = (flowType: FlowType) => {
  const titleLabel = flowType === "income" ? "Income" : "Expense";

  return function FlowDetailsScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const periodScrollerRef = useRef<ScrollView | null>(null);
    const { period: periodParam, accountId } = useLocalSearchParams<PeriodParam>();

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

    const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
    const resolvedPeriod = useMemo(() => {
      const key = typeof periodParam === "string" ? periodParam : undefined;
      const fallbackIndex = Math.max(periodOptions.length - 1, 0);
      return periodOptions.find((option) => option.key === key) ?? periodOptions[fallbackIndex];
    }, [periodOptions, periodParam]);

    const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => resolvedPeriod.key);

    const selectedPeriod = useMemo(
      () => periodOptions.find((option) => option.key === selectedPeriodKey) ?? resolvedPeriod,
      [periodOptions, resolvedPeriod, selectedPeriodKey],
    );

    const { start, end } = useMemo(() => selectedPeriod.range(), [selectedPeriod]);

    const allowedAccountIds = useMemo(() => (selectedAccountId ? null : new Set(visibleAccountIds)), [
      selectedAccountId,
      visibleAccountIds,
    ]);

    const scopedTransactions = useMemo(
      () =>
        filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
          if (!allowedAccountIds || allowedAccountIds.size === 0) {
            return true;
          }

          const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
          const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

          return fromAllowed || toAllowed;
        }),
      [allowedAccountIds, selectedAccountId, transactions],
    );

    const reportableTransactions = useMemo(
      () =>
        scopedTransactions.filter((transaction) => {
          const date = dayjs(transaction.date);
          return !transaction.excludeFromReports && !date.isBefore(start) && !date.isAfter(end);
        }),
      [end, scopedTransactions, start],
    );

    const flowTransactions = useMemo(
      () => reportableTransactions.filter((transaction) => transaction.type === flowType),
      [flowType, reportableTransactions],
    );

    const totalAmount = useMemo(
      () => flowTransactions.reduce((acc, transaction) => acc + transaction.amount, 0),
      [flowTransactions],
    );

    const computeRangeTotal = useCallback(
      (rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs) =>
        scopedTransactions
          .filter((transaction) => !transaction.excludeFromReports)
          .filter((transaction) => transaction.type === flowType)
          .filter((transaction) => {
            const date = dayjs(transaction.date);
            return !date.isBefore(rangeStart) && !date.isAfter(rangeEnd);
          })
          .reduce((acc, transaction) => acc + transaction.amount, 0),
      [flowType, scopedTransactions],
    );

    const trailingAverage = useMemo(() => {
      if (!start.isValid()) return 0;

      const totals: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const monthStart = start.subtract(i, "month").startOf("month");
        const monthEnd = monthStart.endOf("month");
        totals.push(computeRangeTotal(monthStart, monthEnd));
      }

      return totals.length ? totals.reduce((acc, value) => acc + value, 0) / totals.length : 0;
    }, [computeRangeTotal, start]);

    const daysInPeriod = Math.max(end.diff(start, "day") + 1, 1);
    const dailyAverage = totalAmount / daysInPeriod;
    const typeColor = flowType === "income" ? theme.colors.success : theme.colors.danger;
    const rangeLabel = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;

    const buildSlices = useCallback(
      (transactionsForPeriod: typeof flowTransactions, total: number): CategorySlice[] => {
        if (!total) return [];

        const map = new Map<string, number>();
        transactionsForPeriod.forEach((transaction) => {
          const key =
            transaction.category || (flowType === "income" ? "Uncategorized Income" : "Uncategorized Expense");
          map.set(key, (map.get(key) ?? 0) + transaction.amount);
        });

        return Array.from(map.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([label, value], index) => ({
            label,
            value,
            percentage: Math.round((value / total) * 100),
            color: chartPalette[index % chartPalette.length],
          }));
      },
      [flowType],
    );

    const slices = useMemo(
      () => buildSlices(flowTransactions, totalAmount),
      [buildSlices, flowTransactions, totalAmount],
    );

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
          <Text style={styles.title}>{`${titleLabel} details`}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.periodScroller}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              ref={periodScrollerRef}
              onContentSizeChange={(width) => {
                if (width > 0) {
                  periodScrollerRef.current?.scrollToEnd({ animated: false });
                }
              }}
            >
              {periodOptions.map((option) => {
                const active = option.key === selectedPeriodKey;
                const { start: optionStart, end: optionEnd } = option.range();
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSelectedPeriodKey(option.key)}
                    style={[styles.periodChip, active && styles.periodChipActive(theme)]}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${option.label}`}
                  >
                    <Text style={[styles.periodChipLabel, active && styles.periodChipLabelActive(theme)]}>
                      {option.label}
                    </Text>
                    <Text style={styles.periodChipHint}>{`${optionStart.format("MMM D")} – ${optionEnd.format("MMM D")}`}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.summaryCard(theme)}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.overline}>Total</Text>
                <Text style={styles.totalValue(typeColor)}>{formatCurrency(totalAmount, currency)}</Text>
              </View>
              <View style={styles.rangeBadge}>
                <Text style={styles.rangeBadgeLabel}>{rangeLabel}</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard(theme)}>
                <Text style={styles.overline}>Daily average</Text>
                <Text style={styles.metricValue}>{formatCurrency(dailyAverage, currency)}</Text>
              </View>
              <View style={styles.metricCard(theme)}>
                <Text style={styles.overline}>3-month avg</Text>
                <Text style={styles.metricValue}>{formatCurrency(trailingAverage, currency)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.chartCard(theme)}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Category breakdown</Text>
                <Text style={styles.cardSubtitle}>
                  {flowTransactions.length
                    ? `${flowTransactions.length} transaction${flowTransactions.length === 1 ? "" : "s"}`
                    : "No transactions yet"}
                </Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: typeColor }]} />
                <Text style={styles.legendLabel}>{titleLabel}</Text>
              </View>
            </View>

            <View style={styles.chartRow}>
              <PieChart data={slices} theme={theme} size={160} />
              <View style={styles.legendList}>{renderLegend(slices, currency, theme)}</View>
            </View>
          </View>

          <View style={styles.listCard(theme)}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{`${titleLabel} by category`}</Text>
                <Text style={styles.cardSubtitle}>
                  {selectedAccountId ? "Showing selected account" : "Using visible accounts"}
                </Text>
              </View>
              <View style={styles.badge}> 
                <Text style={styles.badgeText}>{selectedAccountId ? "Filtered" : "All"}</Text>
              </View>
            </View>

            {slices.length === 0 ? (
              <Text style={styles.emptyText}>No {titleLabel.toLowerCase()} recorded in this period.</Text>
            ) : (
              slices.map((slice) => (
                <View key={`${slice.label}-${slice.color}`} style={styles.listRow}>
                  <View style={[styles.listIcon, { backgroundColor: `${slice.color}22` }]}> 
                    <View style={[styles.listIconDot, { backgroundColor: slice.color }]} />
                  </View>
                  <View style={styles.listMeta}>
                    <Text style={styles.listLabel}>{slice.label}</Text>
                    <Text style={styles.listHint}>{slice.percentage}% of total</Text>
                  </View>
                  <Text style={styles.listAmount}>{formatCurrency(slice.value, currency)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };
};

const renderLegend = (data: CategorySlice[], currency: string, theme: Theme) => {
  const styles = legendStyles(theme);

  if (!data.length) {
    return <Text style={styles.emptyLegend}>No category data for this period</Text>;
  }

  return data.map((item) => (
    <View key={`${item.label}-${item.color}`} style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
      <View style={styles.legendMeta}>
        <Text style={styles.legendLabel}>{item.label}</Text>
        <Text style={styles.legendAmount}>
          {formatCurrency(item.value, currency)} · {item.percentage}%
        </Text>
      </View>
    </View>
  ));
};

const legendStyles = (theme: Theme) =>
  StyleSheet.create({
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendMeta: {
      flex: 1,
    },
    legendLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    legendAmount: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    emptyLegend: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  });

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
      gap: theme.spacing.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    periodScroller: {
      marginHorizontal: -theme.spacing.lg,
    },
    periodChip: {
      marginHorizontal: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      gap: 2,
      minWidth: 120,
    },
    periodChipActive: (theme: Theme) => ({
      backgroundColor: `${theme.colors.primary}22`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}55`,
    }),
    periodChipLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodChipLabelActive: (theme: Theme) => ({
      color: theme.colors.primary,
    }),
    periodChipHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    summaryCard: (theme: Theme) => ({
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    }),
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    totalValue: (color: string) => ({
      fontSize: 32,
      fontWeight: "800",
      color,
    }),
    rangeBadge: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
    },
    rangeBadgeLabel: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: "600",
    },
    metricRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "wrap",
    },
    metricCard: (theme: Theme) => ({
      flex: 1,
      minWidth: 150,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
      gap: 4,
    }),
    metricValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    chartCard: (theme: Theme) => ({
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    }),
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    cardSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    chartRow: {
      flexDirection: "row",
      gap: theme.spacing.lg,
      alignItems: "center",
      flexWrap: "wrap",
    },
    legendList: {
      flex: 1,
      minWidth: 200,
      alignSelf: "stretch",
    },
    listCard: (theme: Theme) => ({
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    }),
    badge: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    badgeText: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
    },
    listIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    listIconDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    listMeta: {
      flex: 1,
      gap: 2,
    },
    listLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    listHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    listAmount: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.sm,
    },
  });

export default createFlowDetailsScreen;
