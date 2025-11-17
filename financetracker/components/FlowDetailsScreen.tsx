import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import Svg, { Circle, Path } from "react-native-svg";

import { useAppTheme, type Theme } from "../theme";
import { useFinanceStore } from "../lib/store";
import { buildMonthlyPeriods } from "../lib/periods";
import { filterTransactionsByAccount } from "../lib/transactions";

type PeriodParam = { period?: string; accountId?: string };

type FlowType = "income" | "expense";

type CategorySlice = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

const chartPalette = [
  "#60A5FA",
  "#34D399",
  "#F97316",
  "#F472B6",
  "#A78BFA",
  "#FB7185",
  "#FBBF24",
];

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

const polarToCartesian = (center: number, radius: number, angle: number) => ({
  x: center + radius * Math.cos(angle),
  y: center + radius * Math.sin(angle),
});

const describeArc = (
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const start = polarToCartesian(center, radius, startAngle);
  const end = polarToCartesian(center, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

const PieChart = ({ data, size = 160, theme }: { data: CategorySlice[]; size?: number; theme: Theme }) => {
  const radius = size / 2;
  const total = data.reduce((acc, item) => acc + item.value, 0);
  let startAngle = -Math.PI / 2;

  const segments = total
    ? data.map((item) => {
        const angle = total ? (item.value / total) * Math.PI * 2 : 0;
        const path = describeArc(radius, radius, startAngle, startAngle + angle);
        startAngle += angle;
        return { path, color: item.color };
      })
    : [];

  return (
    <Svg width={size} height={size}>
      {segments.length === 0 ? (
        <Circle cx={radius} cy={radius} r={radius} fill={`${theme.colors.border}55`} />
      ) : (
        segments.map((segment, index) => <Path key={index} d={segment.path} fill={segment.color} />)
      )}
      <Circle cx={radius} cy={radius} r={radius * 0.55} fill={theme.colors.surface} />
    </Svg>
  );
};

export function FlowDetailsScreen({ flowType }: { flowType: FlowType }) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const legendStyle = useMemo(() => legendStyles(theme), [theme]);
  const { period: periodParam, accountId } = useLocalSearchParams<PeriodParam>();
  const periodScrollerRef = useRef<ScrollView | null>(null);

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

  const allowedAccountIds = useMemo(() => (selectedAccountId ? null : new Set(visibleAccountIds)), [
    selectedAccountId,
    visibleAccountIds,
  ]);

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
        transaction.type === flowType &&
        !transaction.excludeFromReports &&
        !date.isBefore(start) &&
        !date.isAfter(end)
      );
    });
  }, [allowedAccountIds, end, flowType, selectedAccountId, start, transactions]);

  const totalAmount = useMemo(
    () => reportableTransactions.reduce((acc, transaction) => acc + transaction.amount, 0),
    [reportableTransactions],
  );

  const categorySlices = useMemo(() => {
    if (!reportableTransactions.length) {
      return [] as CategorySlice[];
    }

    const map = new Map<string, number>();
    reportableTransactions.forEach((transaction) => {
      const key = transaction.category || (flowType === "income" ? "Income" : "Expense");
      map.set(key, (map.get(key) ?? 0) + transaction.amount);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({
        label,
        value,
        percentage: totalAmount ? Math.round((value / totalAmount) * 100) : 0,
        color: chartPalette[index % chartPalette.length],
      }));
  }, [flowType, reportableTransactions, totalAmount]);

  const groupedSections = useMemo(() => {
    const grouped = new Map<string, { title: string; transactions: typeof reportableTransactions; total: number }>();

    reportableTransactions
      .slice()
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
      .forEach((transaction) => {
        const key = dayjs(transaction.date).format("YYYY-MM-DD");
        const existing = grouped.get(key) ?? {
          title: dayjs(transaction.date).format("dddd, MMM D"),
          transactions: [],
          total: 0,
        };

        existing.transactions.push(transaction);
        existing.total += transaction.amount;
        grouped.set(key, existing);
      });

    return Array.from(grouped.values());
  }, [reportableTransactions]);

  const accentColor = flowType === "income" ? theme.colors.success : theme.colors.danger;
  const headline = flowType === "income" ? "Income" : "Expense";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>{`${headline} details`}</Text>
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
        <View style={styles.summaryHeader}>
          <Text style={styles.overline}>{headline} this period</Text>
          <View style={styles.countBadge(theme)}>
            <Text style={styles.countLabel}>{reportableTransactions.length} item{reportableTransactions.length === 1 ? "" : "s"}</Text>
          </View>
        </View>
        <Text style={styles.totalValue(accentColor)}>
          {formatCurrency(flowType === "expense" ? -totalAmount : totalAmount, currency, { signDisplay: "always" })}
        </Text>
        <Text style={styles.rangeHint}>{`${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`}</Text>
      </View>

      <View style={styles.chartCard(theme)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Category breakdown</Text>
          <Text style={styles.cardSubtitle}>Top categories for this period</Text>
        </View>
        <View style={styles.chartRow}>
          <PieChart data={categorySlices} theme={theme} />
          <View style={styles.legend}>
            {categorySlices.length === 0 ? (
              <Text style={legendStyle.emptyLegend}>No data for this period</Text>
            ) : (
              categorySlices.map((item) => (
                <View key={`${item.label}-${item.color}`} style={legendStyle.legendRow}>
                  <View style={[legendStyle.legendDot, { backgroundColor: item.color }]} />
                  <View style={legendStyle.legendMeta}>
                    <Text style={legendStyle.legendLabel}>{item.label}</Text>
                    <Text style={legendStyle.legendAmount}>
                      {formatCurrency(item.value, currency)} · {item.percentage}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{headline} activity</Text>
        <Text style={styles.listSubtitle}>Transactions for the selected period</Text>
      </View>

      {groupedSections.map((section) => (
        <View key={section.title} style={styles.section(theme)}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionHint}>{section.transactions.length} result{section.transactions.length === 1 ? "" : "s"}</Text>
            </View>
            <Text style={styles.sectionTotal(accentColor)}>
              {formatCurrency(flowType === "expense" ? -section.total : section.total, currency, {
                signDisplay: "always",
              })}
            </Text>
          </View>

          {section.transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow(theme)}>
              <View style={styles.transactionMeta}>
                <Text style={styles.transactionTitle}>{transaction.note || "Untitled"}</Text>
                <Text style={styles.transactionSubtitle}>
                  {transaction.category || "Uncategorized"} • {dayjs(transaction.date).format("MMM D")}
                </Text>
              </View>
              <Text style={styles.transactionAmount(accentColor)}>
                {formatCurrency(flowType === "expense" ? -transaction.amount : transaction.amount, currency, {
                  signDisplay: "always",
                })}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {reportableTransactions.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="pie-chart-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No activity</Text>
          <Text style={styles.emptyText}>
            Add {headline.toLowerCase()} to see trends and category insights for this period.
          </Text>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const legendStyles = (theme: Theme) =>
  StyleSheet.create({
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
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
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
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
    periodChipActive: (theme: Theme) => ({
      backgroundColor: theme.colors.primary,
    }),
    periodChipLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    periodChipLabelActive: (theme: Theme) => ({
      color: theme.colors.onPrimary,
    }),
    periodChipHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    summaryCard: (theme: Theme) => ({
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.xl,
      gap: theme.spacing.sm,
    }),
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    overline: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    countBadge: (theme: Theme) => ({
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
    }),
    countLabel: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: "600",
    },
    totalValue: (color: string) => ({
      fontSize: 32,
      fontWeight: "800",
      color,
    }),
    rangeHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    chartCard: (theme: Theme) => ({
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.xl,
      gap: theme.spacing.md,
    }),
    cardHeader: {
      gap: 2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    cardSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    chartRow: {
      flexDirection: "row",
      gap: theme.spacing.lg,
      alignItems: "center",
    },
    legend: {
      flex: 1,
    },
    listHeader: {
      gap: 4,
    },
    listTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
    },
    listSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    section: (theme: Theme) => ({
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    }),
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    sectionTotal: (color: string) => ({
      fontSize: 16,
      fontWeight: "700",
      color,
    }),
    transactionRow: (theme: Theme) => ({
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    }),
    transactionMeta: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    transactionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    transactionAmount: (color: string) => ({
      fontSize: 15,
      fontWeight: "700",
      color,
    }),
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
      paddingHorizontal: theme.spacing.lg,
    },
  });

export default FlowDetailsScreen;
