import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import {
  CategorySlice,
  PieChart,
  categoryChartPalette,
} from "../../components/CategoryPieChart";
import { SpendingLineChart, type SpendingPoint } from "../../components/SpendingCharts";
import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount } from "../../lib/transactions";

type DetailType = "income" | "expense";

type PeriodParam = { period?: string; accountId?: string };

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

const buildWeeksForRange = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  const weeks: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
  let cursor = start.startOf("week");

  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const weekStart = cursor.startOf("week");
    const weekEnd = cursor.endOf("week");

    weeks.push({
      start: weekStart.isBefore(start) ? start.startOf("day") : weekStart.startOf("day"),
      end: weekEnd.isAfter(end) ? end.endOf("day") : weekEnd.endOf("day"),
    });

    cursor = cursor.add(1, "week");
  }

  return weeks;
};

const buildLegend = (data: CategorySlice[], currency: string, styles: ReturnType<typeof createStyles>) => {
  if (!data.length) {
    return <Text style={styles.emptyLegend}>No activity recorded for this period.</Text>;
  }

  return data.map((slice) => (
    <View key={slice.label} style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
      <View style={styles.legendMeta}>
        <Text style={styles.legendLabel}>{slice.label}</Text>
        <Text style={styles.legendAmount}>
          {formatCurrency(slice.value, currency)} • {slice.percentage}% of total
        </Text>
      </View>
    </View>
  ));
};

export const createCategoryDetailsScreen = (type: DetailType) => () => {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, type), [theme, type]);
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

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
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
  const accountLabel = selectedAccount ? selectedAccount.name : "All accounts";
  const rangeLabel = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;

  const periodIndex = periodOptions.findIndex((option) => option.key === selectedPeriodKey);
  const comparisonPeriods = periodIndex > 0 ? periodOptions.slice(Math.max(0, periodIndex - 3), periodIndex) : [];

  const buildScopedTransactions = useCallback(
    (rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs) => {
      const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);
      const scopedByAccount = filterTransactionsByAccount(transactions, selectedAccountId).filter(
        (transaction) => {
          if (!allowedAccountIds || allowedAccountIds.size === 0) {
            return true;
          }

          const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
          const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

          return fromAllowed || toAllowed;
        },
      );

      return scopedByAccount.filter((transaction) => {
        if (transaction.type !== type || transaction.excludeFromReports) {
          return false;
        }

        const date = dayjs(transaction.date);
        return !date.isBefore(rangeStart) && !date.isAfter(rangeEnd);
      });
    },
    [selectedAccountId, transactions, type, visibleAccountIds],
  );

  const transactionsForPeriod = useMemo(
    () => buildScopedTransactions(start, end),
    [buildScopedTransactions, end, start],
  );

  const totalAmount = useMemo(
    () => transactionsForPeriod.reduce((acc, transaction) => acc + transaction.amount, 0),
    [transactionsForPeriod],
  );

  const categorySlices: CategorySlice[] = useMemo(() => {
    if (!totalAmount) {
      return [];
    }

    const map = new Map<string, number>();
    transactionsForPeriod.forEach((transaction) => {
      const key = transaction.category || (type === "income" ? "Income" : "Expense");
      map.set(key, (map.get(key) ?? 0) + transaction.amount);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({
        label,
        value,
        percentage: Math.round((value / totalAmount) * 100),
        color: categoryChartPalette[index % categoryChartPalette.length],
      }));
  }, [totalAmount, transactionsForPeriod, type]);

  const comparisonTotals = useMemo(
    () =>
      comparisonPeriods.map(({ range }) => {
        const { start: comparisonStart, end: comparisonEnd } = range();
        const scoped = buildScopedTransactions(comparisonStart, comparisonEnd);
        return scoped.reduce((acc, transaction) => acc + transaction.amount, 0);
      }),
    [buildScopedTransactions, comparisonPeriods],
  );

  const comparisonAverage = useMemo(() => {
    if (!comparisonTotals.length) {
      return 0;
    }
    const total = comparisonTotals.reduce((acc, value) => acc + value, 0);
    return total / comparisonTotals.length;
  }, [comparisonTotals]);

  const comparisonDelta = totalAmount - comparisonAverage;

  const weeks = useMemo(() => buildWeeksForRange(start, end), [start, end]);
  const trendPoints: SpendingPoint[] = useMemo(
    () =>
      weeks.map((range, index) => {
        const scoped = buildScopedTransactions(range.start, range.end);
        const value = scoped.reduce((acc, transaction) => acc + transaction.amount, 0);

        return {
          label: `Week ${index + 1}`,
          value,
          hint: `${range.start.format("MMM D")} – ${range.end.format("MMM D")}`,
        };
      }),
    [buildScopedTransactions, weeks],
  );

  const [viewMode, setViewMode] = useState<"breakdown" | "trend">("breakdown");

  const comparisonPositive = type === "income" ? comparisonDelta >= 0 : comparisonDelta <= 0;

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
        <Text style={styles.title}>{type === "income" ? "Income details" : "Expense details"}</Text>
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
            ref={periodScrollerRef}
            showsHorizontalScrollIndicator={false}
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
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${option.label}`}
                >
                  <Text style={[styles.periodChipLabel, active && styles.periodChipLabelActive]}>
                    {option.label}
                  </Text>
                  <Text style={styles.periodChipHint}>
                    {`${optionStart.format("MMM D")} – ${optionEnd.format("MMM D")}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Ionicons name="calendar" size={14} color={theme.colors.text} />
            <Text style={styles.badgeText}>{rangeLabel}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="wallet" size={14} color={theme.colors.text} />
            <Text style={styles.badgeText}>{accountLabel}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.overline}>{type === "income" ? "Total income" : "Total expense"}</Text>
          <Text style={styles.totalValue(type === "income")}>
            {formatCurrency(totalAmount, currency, { signDisplay: "auto" })}
          </Text>
        </View>

        <View style={styles.compareCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.compareLabel}>Compared to 3-month avg</Text>
            <Text style={styles.compareSubdued}>{formatCurrency(comparisonAverage, currency)}</Text>
          </View>
          <Text style={styles.compareDelta(comparisonPositive)}>
            {formatCurrency(comparisonDelta, currency, { signDisplay: "always" })}
          </Text>
        </View>

        <View style={styles.toggleRow}>
          {["breakdown", "trend"].map((mode) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode as typeof viewMode)}
                style={[styles.toggleButton, active && styles.toggleButtonActive]}
              >
                <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
                  {mode === "breakdown" ? "Breakdown" : "Trend"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {viewMode === "breakdown" ? (
          <View style={styles.cardBody}>
            <PieChart data={categorySlices} theme={theme} size={200} innerFill={theme.colors.surfaceElevated} />
            <View style={styles.legend}>{buildLegend(categorySlices, currency, styles)}</View>
          </View>
        ) : (
          <View style={styles.cardBody}>
            <SpendingLineChart
              data={trendPoints}
              formatValue={(value) => formatCurrency(value, currency, { maximumFractionDigits: 0 })}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>, type: DetailType) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
    },
    iconButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surface,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl * 2,
      gap: theme.spacing.lg,
    },
    periodScroller: {
      marginTop: theme.spacing.xs,
    },
    periodChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.lg,
      marginRight: theme.spacing.sm,
      gap: 2,
      minWidth: 120,
    },
    periodChipActive: {
      borderWidth: 1,
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    periodChipLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodChipLabelActive: {
      color: theme.colors.primary,
    },
    periodChipHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    metaRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
      alignItems: "center",
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: `${theme.colors.border}80`,
    },
    badgeText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    summaryCard: {
      ...theme.components.card,
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.lg,
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    totalValue: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "800",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    compareCard: {
      ...theme.components.card,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.xs,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    compareLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    compareSubdued: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    compareDelta: (positive: boolean) => ({
      fontSize: 24,
      fontWeight: "800",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    toggleRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.full,
      padding: 4,
      gap: 4,
    },
    toggleButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.full,
      alignItems: "center",
    },
    toggleButtonActive: {
      backgroundColor: `${theme.colors.primary}22`,
    },
    toggleLabel: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    toggleLabelActive: {
      color: theme.colors.text,
    },
    cardBody: {
      ...theme.components.card,
      gap: theme.spacing.md,
      alignItems: "center",
    },
    legend: {
      alignSelf: "stretch",
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendMeta: {
      flex: 1,
    },
    legendLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    legendAmount: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    emptyLegend: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

