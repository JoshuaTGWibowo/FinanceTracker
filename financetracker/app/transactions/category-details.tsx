import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import {
  CATEGORY_PALETTE,
  CategoryPieChart,
  type CategorySlice,
} from "../../components/CategoryPieChart";
import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount } from "../../lib/transactions";

type CategoryDetailsParams = { type?: string; period?: string; accountId?: string };

type CategoryType = "income" | "expense";

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

export default function CategoryDetailsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { type: typeParam, period: periodParam, accountId } =
    useLocalSearchParams<CategoryDetailsParams>();
  const periodScrollerRef = useRef<ScrollView | null>(null);

  const categoryType: CategoryType = typeParam === "expense" ? "expense" : "income";

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
    () => (selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) : null),
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

  const allowedAccountIds = useMemo(() => (selectedAccountId ? null : new Set(visibleAccountIds)), [
    selectedAccountId,
    visibleAccountIds,
  ]);

  const reportableTransactions = useMemo(() => {
    const scoped = filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
      if (!allowedAccountIds || allowedAccountIds.size === 0) {
        return true;
      }

      const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
      const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

      return fromAllowed || toAllowed;
    });

    return scoped.filter((transaction) => {
      const date = dayjs(transaction.date);
      return (
        transaction.type === categoryType && !transaction.excludeFromReports && !date.isBefore(start) && !date.isAfter(end)
      );
    });
  }, [allowedAccountIds, categoryType, end, selectedAccountId, start, transactions]);

  const { slices, total } = useMemo(() => {
    const totals = new Map<string, number>();
    let sum = 0;

    reportableTransactions.forEach((transaction) => {
      const key = transaction.category || (categoryType === "income" ? "Uncategorized income" : "Uncategorized expense");
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
      sum += transaction.amount;
    });

    const entries: CategorySlice[] = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({
        label,
        value,
        percentage: sum ? Math.round((value / sum) * 100) : 0,
        color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
      }));

    return { slices: entries, total: sum };
  }, [categoryType, reportableTransactions]);

  const periodLengthDays = Math.max(1, end.diff(start, "day") + 1);
  const dailyAverage = total / periodLengthDays;
  const rangeLabel = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
  const accountLabel = selectedAccount?.name ?? "All accounts";
  const highlightColor = categoryType === "income" ? theme.colors.success : theme.colors.danger;
  const title = categoryType === "income" ? "Income details" : "Expense details";

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
        <Text style={styles.title}>{title}</Text>
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
            onContentSizeChange={(width) => {
              if (width > 0) {
                periodScrollerRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ref={periodScrollerRef}
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
                  <Text style={styles.periodChipHint}>
                    {`${optionStart.format("MMM D")} – ${optionEnd.format("MMM D")}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.summaryCard(theme)}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMeta}>
              <Text style={styles.overline}>{categoryType === "income" ? "Total income" : "Total expense"}</Text>
              <Text style={[styles.totalValue, { color: highlightColor }]}>
                {formatCurrency(total, currency)}
              </Text>
              <Text style={styles.rangeLabel}>{rangeLabel}</Text>
              <Text style={styles.accountLabel}>Scope: {accountLabel}</Text>
            </View>
            <View style={styles.summaryPill(highlightColor)}>
              <Ionicons
                name={categoryType === "income" ? "trending-up" : "trending-down"}
                size={16}
                color={highlightColor}
              />
              <Text style={styles.summaryPillText(highlightColor)}>
                {categoryType === "income" ? "Income" : "Expense"}
              </Text>
            </View>
          </View>
          <View style={styles.summaryFooter}>
            <Text style={styles.summaryHint}>Daily average</Text>
            <Text style={styles.summaryHintValue}>{formatCurrency(dailyAverage, currency)}</Text>
          </View>
        </View>

        <View style={styles.chartCard(theme)}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Category breakdown</Text>
              <Text style={styles.cardSubtitle}>
                {slices.length ? `${slices.length} categories` : "No data for this period"}
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: highlightColor }]} />
              <Text style={styles.legendLabel}>{categoryType === "income" ? "Income" : "Expense"}</Text>
            </View>
          </View>

          <View style={styles.chartArea}>
            <CategoryPieChart data={slices} size={180} />
          </View>

          <View style={styles.legend}>
            {slices.length === 0 ? (
              <Text style={styles.emptyLegend}>No transactions to chart yet.</Text>
            ) : (
              slices.map((slice) => (
                <View key={slice.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                  <View style={styles.legendMeta}>
                    <Text style={styles.legendLabel}>{slice.label}</Text>
                    <Text style={styles.legendAmount}>
                      {formatCurrency(slice.value, currency)} · {slice.percentage}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Categories</Text>
          <Text style={styles.listSubtitle}>Sorted by amount</Text>
        </View>

        {slices.map((slice) => (
          <View key={`row-${slice.label}`} style={styles.categoryRow(theme)}>
            <View style={[styles.categoryDot, { backgroundColor: slice.color }]} />
            <View style={styles.categoryMeta}>
              <Text style={styles.categoryLabel}>{slice.label}</Text>
              <Text style={styles.categoryPercent}>{slice.percentage}% of total</Text>
            </View>
            <Text style={styles.categoryAmount}>{formatCurrency(slice.value, currency)}</Text>
          </View>
        ))}

        {slices.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptyText}>
              Add {categoryType === "income" ? "income" : "expense"} transactions in this period to see a
              breakdown.
            </Text>
          </View>
        )}
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
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceElevated,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
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
    },
    periodChipActive: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      backgroundColor: `${currentTheme.colors.primary}18`,
      borderColor: currentTheme.colors.primary,
    }),
    periodChipLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodChipLabelActive: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      color: currentTheme.colors.primary,
    }),
    periodChipHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    summaryCard: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      ...currentTheme.components.card,
      borderRadius: currentTheme.radii.lg,
      gap: currentTheme.spacing.md,
    }),
    summaryRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    summaryMeta: {
      flex: 1,
      gap: 4,
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    totalValue: {
      fontSize: 32,
      fontWeight: "700",
    },
    rangeLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    accountLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    summaryPill: (color: string) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.lg,
      backgroundColor: `${color}18`,
      alignSelf: "flex-start",
    }),
    summaryPillText: (color: string) => ({
      fontSize: 13,
      fontWeight: "700",
      color,
    }),
    summaryFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    summaryHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    summaryHintValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    chartCard: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      ...currentTheme.components.card,
      borderRadius: currentTheme.radii.lg,
      gap: currentTheme.spacing.md,
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
    chartArea: {
      alignItems: "center",
      justifyContent: "center",
    },
    legend: {
      gap: theme.spacing.sm,
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
    listHeader: {
      gap: 4,
      marginTop: theme.spacing.md,
    },
    listTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    listSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    categoryRow: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      ...currentTheme.components.card,
      borderRadius: currentTheme.radii.lg,
      paddingVertical: currentTheme.spacing.md,
      paddingHorizontal: currentTheme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: currentTheme.spacing.md,
    }),
    categoryDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    categoryMeta: {
      flex: 1,
      gap: 2,
    },
    categoryLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    categoryPercent: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    categoryAmount: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xl,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
  });
