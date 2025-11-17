import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import dayjs from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount, getTransactionDelta } from "../../lib/transactions";

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

interface CategorySlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

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

const PieChart = ({ data, size = 140, theme }: { data: CategorySlice[]; size?: number; theme: Theme }) => {
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

export default function TransactionsReportModal() {
  const theme = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { period: periodParam, accountId } = useLocalSearchParams<{ period?: string; accountId?: string }>();
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const baseCurrency = currency || "USD";
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => {
    const options = buildMonthlyPeriods();
    const key = typeof periodParam === "string" ? periodParam : undefined;
    return options.find((option) => option.key === key)?.key ?? options[options.length - 1].key;
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    typeof accountId === "string" && accountId.length ? accountId : null,
  );

  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency,
      ),
    [accounts, baseCurrency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const resolvedPeriod = useMemo(() => {
    return periodOptions.find((option) => option.key === selectedPeriodKey) ?? periodOptions[periodOptions.length - 1];
  }, [periodOptions, selectedPeriodKey]);

  const { start, end } = useMemo(() => resolvedPeriod.range(), [resolvedPeriod]);
  const selectedAccount = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId)
    : undefined;
  const accountName = selectedAccountId ? selectedAccount?.name ?? "Selected account" : "All accounts";
  const rangeLabel = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;

  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);

  const handleSelectPeriod = (key: string) => {
    setSelectedPeriodKey(key);
    setShowPeriodSheet(false);
  };

  const handleSelectAccount = (value: string | null) => {
    setSelectedAccountId(value);
    setShowAccountSheet(false);
  };

  const formatAccountType = (type?: string | null) =>
    type ? `${type.slice(0, 1).toUpperCase()}${type.slice(1)}` : "Account";

  const report = useMemo(() => {
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
      return !date.isBefore(start) && !date.isAfter(end);
    });

    const reportable = withinRange.filter((transaction) => !transaction.excludeFromReports);

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

    const buildSlices = (type: "income" | "expense", total: number): CategorySlice[] => {
      if (!total) {
        return [];
      }
      const map = new Map<string, number>();
      reportable.forEach((transaction) => {
        if (transaction.type !== type) {
          return;
        }
        const key = transaction.category || (type === "income" ? "Income" : "Expense");
        map.set(key, (map.get(key) ?? 0) + transaction.amount);
      });

      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value], index) => ({
          label,
          value,
          percentage: Math.round((value / total) * 100),
          color: chartPalette[index % chartPalette.length],
        }));
    };

    return {
      openingBalance,
      closingBalance,
      netChange,
      totals,
      incomeSlices: buildSlices("income", totals.income),
      expenseSlices: buildSlices("expense", totals.expense),
    };
  }, [end, selectedAccountId, start, transactions, visibleAccountIds]);

  const netPositive = report.netChange >= 0;
  const accountLabel = selectedAccountId ? accountName : "All accounts";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundAccent} pointerEvents="none">
        <View style={styles.accentBlobPrimary} />
        <View style={styles.accentBlobSecondary} />
      </View>
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close report"
        >
          <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Period report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.metaRow}>
          <Pressable
            style={styles.metaSelector}
            onPress={() => setShowPeriodSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose period"
          >
            <View style={styles.metaSelectorContent}>
              <Text style={styles.metaLabel}>Period</Text>
              <Text style={styles.metaValue}>{resolvedPeriod.label}</Text>
              <Text style={styles.metaSubValue}>{rangeLabel}</Text>
            </View>
            <View style={styles.metaSelectorBadge}>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
            </View>
          </Pressable>

          <Pressable
            style={styles.metaSelector}
            onPress={() => setShowAccountSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose account"
          >
            <View style={styles.metaSelectorContent}>
              <Text style={styles.metaLabel}>Account</Text>
              <Text style={styles.metaValue}>{accountLabel}</Text>
              <Text style={styles.metaSubValue} numberOfLines={1} ellipsizeMode="tail">
                {selectedAccount
                  ? formatCurrency(selectedAccount.balance, selectedAccount.currency || currency)
                  : `${visibleAccounts.length || accounts.length} accounts included`}
              </Text>
            </View>
            <View style={styles.metaSelectorBadge}>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
            </View>
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceOverline}>Opening balance</Text>
            <Text style={styles.balanceOverline}>Ending balance</Text>
          </View>
          <View style={styles.balanceValues}>
            <Text style={styles.balanceValue}>{formatCurrency(report.openingBalance, currency)}</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textMuted} />
            <Text style={styles.balanceValue}>{formatCurrency(report.closingBalance, currency)}</Text>
          </View>
        </View>

        <View style={styles.netCard}>
          <View style={styles.netHeader}>
            <Text style={styles.netTitle}>Net income</Text>
            <Text style={styles.netLink}>See details</Text>
          </View>
          <Text style={styles.netAmount(netPositive)}>
            {formatCurrency(report.netChange, currency, { signDisplay: "always" })}
          </Text>
          <View style={styles.netBreakdownRow}>
            <View style={styles.netBreakdownItem}>
              <Text style={styles.netLabel}>Income</Text>
              <Text style={styles.netValue(theme.colors.success)}>
                {formatCurrency(report.totals.income, currency)}
              </Text>
            </View>
            <View style={styles.netBreakdownItem}>
              <Text style={styles.netLabel}>Expense</Text>
              <Text style={styles.netValue(theme.colors.danger)}>
                {formatCurrency(report.totals.expense, currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>Category report</Text>
            <Text style={styles.categorySubtitle}>Breakdown of income and spend</Text>
          </View>
          <View style={styles.categoryGrid}>
            <View style={styles.categoryColumn}>
              <Text style={styles.categoryColumnLabel}>Income</Text>
              <PieChart data={report.incomeSlices} theme={theme} size={120} />
              <View style={styles.legend}>{renderLegend(report.incomeSlices, currency, theme)}</View>
            </View>
            <View style={styles.categoryColumn}>
              <Text style={styles.categoryColumnLabel}>Expense</Text>
              <PieChart data={report.expenseSlices} theme={theme} size={120} />
              <View style={styles.legend}>{renderLegend(report.expenseSlices, currency, theme)}</View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showPeriodSheet} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPeriodSheet(false)} />
          <View
            style={[styles.modalSheet, { backgroundColor: theme.colors.background }]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose period</Text>
              <Pressable onPress={() => setShowPeriodSheet(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false}>
              {periodOptions.map((option) => {
                const active = option.key === resolvedPeriod.key;
                const optionRange = option.range();
                const optionRangeLabel = `${optionRange.start.format("MMM D")} – ${optionRange.end.format("MMM D, YYYY")}`;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => handleSelectPeriod(option.key)}
                  >
                    <View style={styles.optionMeta}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      <Text style={styles.optionSubtitle}>{optionRangeLabel}</Text>
                    </View>
                    <View style={styles.optionTrailing}>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAccountSheet} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowAccountSheet(false)} />
          <View
            style={[styles.modalSheet, { backgroundColor: theme.colors.background }]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose account</Text>
              <Pressable onPress={() => setShowAccountSheet(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false}>
              <Pressable
                style={[styles.optionRow, !selectedAccountId && styles.optionRowActive]}
                onPress={() => handleSelectAccount(null)}
              >
                <View style={styles.optionMeta}>
                  <Text style={styles.optionLabel}>All accounts</Text>
                  <Text style={styles.optionSubtitle}>
                    {visibleAccounts.length > 0
                      ? `${visibleAccounts.length} in base currency`
                      : "Include every balance"}
                  </Text>
                </View>
                <View style={styles.optionTrailing}>
                  {!selectedAccountId ? (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  )}
                </View>
              </Pressable>

              {accounts.map((account) => {
                const active = selectedAccountId === account.id;
                return (
                  <Pressable
                    key={account.id}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => handleSelectAccount(account.id)}
                  >
                    <View style={styles.optionMeta}>
                      <Text style={styles.optionLabel}>{account.name}</Text>
                      <Text style={styles.optionSubtitle}>
                        {`${formatAccountType(account.type)} • ${account.currency || baseCurrency}`}
                      </Text>
                    </View>
                    <View style={styles.optionTrailing}>
                      <Text style={styles.optionValue}>
                        {formatCurrency(account.balance, account.currency || currency)}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const renderLegend = (data: CategorySlice[], currency: string, theme: Theme) => {
  const styles = legendStyles(theme);

  if (!data.length) {
    return <Text style={styles.emptyLegend}>No data for this period</Text>;
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
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backgroundAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 220,
      overflow: "hidden",
    },
    accentBlobPrimary: {
      position: "absolute",
      top: -140,
      right: -40,
      width: 280,
      height: 280,
      borderRadius: 220,
      backgroundColor: `${theme.colors.primary}18`,
      transform: [{ rotate: "12deg" }],
    },
    accentBlobSecondary: {
      position: "absolute",
      top: -20,
      left: -80,
      width: 220,
      height: 220,
      borderRadius: 180,
      backgroundColor: `${theme.colors.accent}18`,
    },
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    headerTitle: {
      ...theme.typography.title,
      fontSize: 22,
    },
    headerSpacer: {
      width: 36,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl + 16,
      gap: theme.spacing.lg,
    },
    metaRow: {
      ...theme.components.card,
      flexDirection: "row",
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}12`,
      padding: theme.spacing.lg,
    },
    metaSelector: {
      flex: 1,
      flexDirection: "row",
      gap: theme.spacing.md,
      alignItems: "center",
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}10`,
    },
    metaSelectorContent: {
      flex: 1,
      gap: 6,
    },
    metaSelectorBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}10`,
    },
    metaLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.colors.textMuted,
    },
    metaValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    metaSubValue: {
      fontSize: 13,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    modalSheet: {
      borderTopLeftRadius: theme.radii.lg,
      borderTopRightRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 12,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 46,
      height: 4,
      borderRadius: 4,
      backgroundColor: `${theme.colors.textMuted}55`,
      marginBottom: theme.spacing.sm,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sheetClose: {
      padding: theme.spacing.sm,
      marginRight: -theme.spacing.sm,
    },
    optionList: {
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    optionRow: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    optionRowActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}10`,
    },
    optionMeta: {
      flex: 1,
      gap: 4,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    optionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    optionTrailing: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    optionValue: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
    },
    balanceCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}10`,
    },
    balanceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    balanceOverline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    balanceValues: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    balanceValue: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
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
    netLink: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: "600",
    },
    netAmount: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    netBreakdownRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "wrap",
    },
    netBreakdownItem: {
      flex: 1,
      minWidth: 140,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    netLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    netValue: (color: string) => ({
      fontSize: 18,
      fontWeight: "600",
      color,
    }),
    categoryCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.lg,
    },
    categoryHeader: {
      gap: 4,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categorySubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    categoryGrid: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "nowrap",
      alignItems: "stretch",
    },
    categoryColumn: {
      flex: 1,
      minWidth: 0,
      flexBasis: 0,
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
    },
    categoryColumnLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    legend: {
      alignSelf: "stretch",
    },
  });
