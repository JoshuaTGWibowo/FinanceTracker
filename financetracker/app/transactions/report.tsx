import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import dayjs from "dayjs";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { buildPeriodOverview } from "../../lib/reporting";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

const getParamValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const parseDateParam = (value?: string) => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

interface CategoryChartProps {
  title: string;
  total: number;
  currency: string;
  data: ReturnType<typeof buildPeriodOverview>["expenseBreakdown"];
  colors: string[];
}

const CategoryPieChart = ({ title, total, currency, data, colors }: CategoryChartProps) => {
  const theme = useAppTheme();
  if (!total || !data.length) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderLabel}>{title}</Text>
        <Text style={styles.chartPlaceholderText}>Not enough data</Text>
      </View>
    );
  }

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.pieWrapper}>
        <Svg width={110} height={110}>
          <Circle cx={55} cy={55} r={radius} stroke={`${theme.colors.border}55`} strokeWidth={12} fill="transparent" />
          {data.map((entry, index) => {
            const valuePortion = entry.amount / total;
            const dasharray = `${circumference * valuePortion} ${circumference}`;
            const dashoffset = circumference * (1 - cumulative - valuePortion);
            cumulative += valuePortion;
            return (
              <Circle
                key={`${entry.category}-${index}`}
                cx={55}
                cy={55}
                r={radius}
                stroke={colors[index % colors.length]}
                strokeWidth={12}
                fill="transparent"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
              />
            );
          })}
        </Svg>
        <View style={styles.pieCenter}>
          <Text style={styles.pieTitle}>{title}</Text>
          <Text style={styles.pieValue}>{formatCurrency(total, currency)}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {data.map((entry, index) => (
          <View key={`${entry.category}-${index}`} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors[index % colors.length] }]} />
            <View style={styles.legendInfo}>
              <Text style={styles.legendLabel}>{entry.category}</Text>
              <Text style={styles.legendValue}>
                {formatCurrency(entry.amount, currency)} · {entry.percentage}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function TransactionsReportScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    period?: string | string[];
    accountId?: string | string[];
    categories?: string | string[];
    min?: string | string[];
    max?: string | string[];
    search?: string | string[];
    start?: string | string[];
    end?: string | string[];
  }>();

  const transactions = useFinanceStore((state) => state.transactions);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const initialPeriodKey = getParamValue(params.period) ?? periodOptions[periodOptions.length - 1]?.key ?? "";
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriodKey);

  const filterConfig = useMemo(() => {
    const accountId = getParamValue(params.accountId) || null;
    const categoriesRaw = getParamValue(params.categories);
    const selectedCategories = categoriesRaw ? categoriesRaw.split(",").filter(Boolean) : [];
    const minValue = getParamValue(params.min);
    const maxValue = getParamValue(params.max);
    const searchTerm = getParamValue(params.search) ?? "";
    const startDate = parseDateParam(getParamValue(params.start));
    const endDate = parseDateParam(getParamValue(params.end));

    return {
      accountId,
      selectedCategories,
      minAmount: minValue ? Number(minValue) : undefined,
      maxAmount: maxValue ? Number(maxValue) : undefined,
      searchTerm,
      startDate,
      endDate,
    };
  }, [params.accountId, params.categories, params.end, params.max, params.min, params.search, params.start]);

  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || currency) === currency,
      ),
    [accounts, currency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const periodRange = useMemo(() => {
    const period =
      periodOptions.find((option) => option.key === selectedPeriod) ?? periodOptions[periodOptions.length - 1];
    return period.range();
  }, [periodOptions, selectedPeriod]);

  const overview = useMemo(
    () =>
      buildPeriodOverview({
        transactions,
        recurringTransactions,
        visibleAccountIds,
        selectedAccountId: filterConfig.accountId,
        range: periodRange,
        filters: {
          minAmount: filterConfig.minAmount,
          maxAmount: filterConfig.maxAmount,
          selectedCategories: filterConfig.selectedCategories,
          searchTerm: filterConfig.searchTerm,
          startDate: filterConfig.startDate,
          endDate: filterConfig.endDate,
        },
      }),
    [
      filterConfig.accountId,
      filterConfig.endDate,
      filterConfig.maxAmount,
      filterConfig.minAmount,
      filterConfig.searchTerm,
      filterConfig.selectedCategories,
      filterConfig.startDate,
      periodRange,
      recurringTransactions,
      transactions,
      visibleAccountIds,
    ],
  );

  const accountLabel = useMemo(() => {
    if (!filterConfig.accountId) {
      return "All accounts";
    }
    const account = accounts.find((item) => item.id === filterConfig.accountId);
    return account ? account.name : "Selected account";
  }, [accounts, filterConfig.accountId]);

  const periodLabel = useMemo(() => {
    const option = periodOptions.find((item) => item.key === selectedPeriod);
    return option?.label ?? "Current period";
  }, [periodOptions, selectedPeriod]);

  const chartColors = [theme.colors.primary, theme.colors.accent, theme.colors.success, theme.colors.danger, theme.colors.text];

  const netPositive = overview.summary.net >= 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={18} color={theme.colors.text} />
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Balance report</Text>
          <View style={{ width: 64 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.cardEyebrow}>{accountLabel}</Text>
            <Text style={styles.balanceValue}>{formatCurrency(overview.summary.closingBalance, currency)}</Text>
            <Text style={[styles.balanceChange, { color: netPositive ? theme.colors.success : theme.colors.danger }]}>
              {netPositive ? "+" : ""}
              {formatCurrency(Math.abs(overview.summary.net), currency)} · {overview.summary.percentageChange}
            </Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceColumn}>
                <Text style={styles.balanceLabel}>Opening balance</Text>
                <Text style={styles.balanceColumnValue}>{formatCurrency(overview.summary.openingBalance, currency)}</Text>
              </View>
              <View style={styles.balanceColumn}>
                <Text style={styles.balanceLabel}>Ending balance</Text>
                <Text style={styles.balanceColumnValue}>{formatCurrency(overview.summary.closingBalance, currency)}</Text>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodChips}>
            {periodOptions.map((option) => {
              const active = option.key === selectedPeriod;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.periodChip, { borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? theme.colors.primary : "transparent" }]}
                  onPress={() => setSelectedPeriod(option.key)}
                >
                  <Text style={[styles.periodChipText, { color: active ? "#fff" : theme.colors.text }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated }]}>
            <View style={styles.netHeader}>
              <View>
                <Text style={styles.cardEyebrow}>{periodLabel}</Text>
                <Text style={styles.netTitle}>Net income</Text>
                <Text style={[styles.netValue, { color: netPositive ? theme.colors.success : theme.colors.danger }]}>
                  {netPositive ? "+" : "-"}
                  {formatCurrency(Math.abs(overview.summary.net), currency)}
                </Text>
              </View>
              <Pressable style={styles.detailsButton}>
                <Text style={styles.detailsButtonText}>See details</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.netRow}>
              <View style={styles.netColumn}>
                <Text style={styles.netLabel}>Income</Text>
                <Text style={[styles.netColumnValue, { color: theme.colors.success }]}>
                  {formatCurrency(overview.summary.income, currency)}
                </Text>
              </View>
              <View style={styles.netColumn}>
                <Text style={styles.netLabel}>Expenses</Text>
                <Text style={[styles.netColumnValue, { color: theme.colors.danger }]}>
                  {formatCurrency(overview.summary.expense, currency)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.categoryHeader}>
              <View>
                <Text style={styles.cardEyebrow}>Category report</Text>
                <Text style={styles.categoryTitle}>See where your money moves</Text>
              </View>
              <Pressable style={styles.secondaryLink}>
                <Text style={styles.secondaryLinkText}>View by categories</Text>
                <Ionicons name="open-outline" size={14} color={theme.colors.primary} />
              </Pressable>
            </View>
            <View style={styles.categoryCharts}>
              <CategoryPieChart
                title="Income"
                total={overview.summary.income}
                currency={currency}
                data={overview.incomeBreakdown}
                colors={chartColors}
              />
              <CategoryPieChart
                title="Expenses"
                total={overview.summary.expense}
                currency={currency}
                data={overview.expenseBreakdown}
                colors={chartColors}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
  },
  cardEyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#94A3B8",
    marginBottom: 6,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: "700",
    color: "#F8FAFF",
  },
  balanceChange: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    marginTop: 18,
    gap: 16,
  },
  balanceColumn: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceColumnValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F8FAFF",
  },
  periodChips: {
    gap: 8,
  },
  periodChip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  netHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F8FAFF",
  },
  netValue: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 8,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  netRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 20,
  },
  netColumn: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  netLabel: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 4,
  },
  netColumnValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F8FAFF",
    marginTop: 4,
  },
  secondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  secondaryLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#60A5FA",
  },
  categoryCharts: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    flexWrap: "wrap",
  },
  chartContainer: {
    flex: 1,
    minWidth: 180,
  },
  pieWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pieCenter: {
    position: "absolute",
    alignItems: "center",
  },
  pieTitle: {
    fontSize: 12,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pieValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8FAFF",
    marginTop: 4,
  },
  legend: {
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendInfo: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  legendValue: {
    fontSize: 12,
    color: "#94A3B8",
  },
  chartPlaceholder: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  chartPlaceholderLabel: {
    fontSize: 12,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: "#E2E8F0",
  },
});
