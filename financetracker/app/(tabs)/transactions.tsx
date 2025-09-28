import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs, { type Dayjs } from "dayjs";

import { useAppTheme } from "../../theme";
import { Transaction, useFinanceStore } from "../../lib/store";

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

interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
}

const MONTHS_TO_DISPLAY = 12;

const buildMonthlyPeriods = (): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");

  return Array.from({ length: MONTHS_TO_DISPLAY }).map((_, index) => {
    const month = currentMonth.subtract(index, "month");
    const start = month.startOf("month");
    const end = month.endOf("month");

    return {
      key: month.format("YYYY-MM"),
      label: month.format("MMM YYYY"),
      range: () => ({ start, end }),
    };
  });
};

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const logRecurringTransaction = useFinanceStore((state) => state.logRecurringTransaction);

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(() => periodOptions[0]?.key ?? "");
  const [reportExpanded, setReportExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const availableTags = useMemo(
    () =>
      Array.from(
        new Set(
          transactions.flatMap((transaction) => transaction.tags ?? []).filter((tag) => tag && tag.length > 0),
        ),
      ),
    [transactions],
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSelectedTags([]);
    setStartDate(null);
    setEndDate(null);
  };

  const { sections, summary, expenseBreakdown, periodLabel, filteredRecurring } = useMemo(() => {
    const fallback = {
      key: dayjs().format("YYYY-MM"),
      label: dayjs().format("MMM YYYY"),
      range: () => ({ start: dayjs().startOf("month"), end: dayjs().endOf("month") }),
    } satisfies PeriodOption;
    const period = periodOptions.find((option) => option.key === selectedPeriod) ?? fallback;
    const { start, end } = period.range();

    const minAmountValue = Number(minAmount) || 0;
    const maxAmountValue = Number(maxAmount) || Number.POSITIVE_INFINITY;
    const lowerBound = minAmount.trim() ? minAmountValue : 0;
    const upperBound = maxAmount.trim() ? maxAmountValue : Number.POSITIVE_INFINITY;

    const withinRange = transactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      if (date.isBefore(start) || date.isAfter(end)) {
        return false;
      }

      if (startDate && date.isBefore(startDate)) {
        return false;
      }

      if (endDate && date.isAfter(endDate)) {
        return false;
      }

      const amount = transaction.amount;
      if (amount < lowerBound || amount > upperBound) {
        return false;
      }

      if (selectedTags.length && !selectedTags.some((tag) => transaction.tags?.includes(tag))) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchesNote = transaction.note.toLowerCase().includes(query);
        const matchesCategory = transaction.category.toLowerCase().includes(query);
        const matchesTags = (transaction.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
        if (!matchesNote && !matchesCategory && !matchesTags) {
          return false;
        }
      }

      return true;
    });

    const sortedDesc = [...withinRange].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const grouped = new Map<string, Transaction[]>();
    sortedDesc.forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      const existing = grouped.get(key) ?? [];
      existing.push(transaction);
      grouped.set(key, existing);
    });

    const sectionData = Array.from(grouped.entries()).map(([key, value]) => ({
      title: dayjs(key).format("dddd, MMM D"),
      data: value,
    }));

    const totals = withinRange.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else {
          acc.expense += transaction.amount;
        }

        return acc;
      },
      { income: 0, expense: 0 },
    );

    const sortedAsc = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let openingBalance = 0;
    let netChange = 0;

    sortedAsc.forEach((transaction) => {
      const value = transaction.type === "income" ? transaction.amount : -transaction.amount;
      const date = dayjs(transaction.date);

      if (date.isBefore(start)) {
        openingBalance += value;
      } else if (!date.isAfter(end)) {
        netChange += value;
      }
    });

    const closingBalance = openingBalance + netChange;

    const expenseMap = withinRange.reduce((acc, transaction) => {
      if (transaction.type !== "expense") {
        return acc;
      }

      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const expenseBreakdown = Array.from(expenseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totals.expense ? Math.round((amount / totals.expense) * 100) : 0,
      }));

    const filteredRecurring = recurringTransactions.filter((recurring) => {
      const occurrence = dayjs(recurring.nextOccurrence);
      return !occurrence.isBefore(start) && !occurrence.isAfter(end);
    });

    return {
      sections: sectionData,
      summary: {
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        openingBalance,
        closingBalance,
      },
      expenseBreakdown,
      periodLabel: period.label,
      filteredRecurring,
    };
  }, [
    endDate,
    maxAmount,
    minAmount,
    periodOptions,
    recurringTransactions,
    searchTerm,
    selectedPeriod,
    selectedTags,
    startDate,
    transactions,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingBlock}>
              <Text style={styles.title}>Transactions</Text>
              <Text style={styles.subtitle}>
                Review, search, and report on your cash flow.
              </Text>
            </View>
            <View style={styles.periodTabs}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodTabsContent}
              >
                {periodOptions.map((option) => {
                  const active = option.key === selectedPeriod;
                  return (
                    <Pressable
                      key={option.key}
                      style={[styles.periodTab, active && styles.periodTabActive]}
                      onPress={() => setSelectedPeriod(option.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.periodText, active && styles.periodTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filtersCard}>
              <Text style={styles.filterTitle}>Quick filters</Text>
              <View style={styles.filterRow}>
                <View style={styles.filterColumn}>
                  <Text style={styles.filterLabel}>Search</Text>
                  <TextInput
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Note, category, or tag"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterColumn}>
                  <Text style={styles.filterLabel}>Min amount</Text>
                  <TextInput
                    value={minAmount}
                    onChangeText={setMinAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                </View>
                <View style={styles.filterColumn}>
                  <Text style={styles.filterLabel}>Max amount</Text>
                  <TextInput
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    keyboardType="numeric"
                    placeholder="Any"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterColumn}>
                  <Text style={styles.filterLabel}>Start date</Text>
                  <Pressable
                    onPress={() => setShowStartPicker(true)}
                    style={styles.dateButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.dateButtonText}>
                      {startDate ? startDate.format("MMM D, YYYY") : "Any"}
                    </Text>
                    <Ionicons name="calendar" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.filterColumn}>
                  <Text style={styles.filterLabel}>End date</Text>
                  <Pressable
                    onPress={() => setShowEndPicker(true)}
                    style={styles.dateButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.dateButtonText}>
                      {endDate ? endDate.format("MMM D, YYYY") : "Any"}
                    </Text>
                    <Ionicons name="calendar" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Tags</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagsRow}
                >
                  {availableTags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        style={[styles.tagChip, active && styles.tagChipActive]}
                      >
                        <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Categories</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagsRow}
                >
                  {categories.map((category) => {
                    const active = selectedTags.includes(category);
                    return (
                      <Pressable
                        key={category}
                        onPress={() => toggleTag(category)}
                        style={[styles.tagChip, active && styles.tagChipActive]}
                      >
                        <Text style={[styles.tagText, active && styles.tagTextActive]}>{category}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {(searchTerm || minAmount || maxAmount || selectedTags.length || startDate || endDate) && (
                <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.text} />
                  <Text style={styles.clearFiltersText}>Clear filters</Text>
                </Pressable>
              )}
            </View>

            <View style={[theme.components.card, styles.summaryCard]}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryTitleBlock}>
                  <Text style={styles.summaryLabel}>Ending balance</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(summary.closingBalance, currency || "USD")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.netBadge,
                    {
                      backgroundColor:
                        summary.net >= 0 ? "rgba(52,211,153,0.12)" : "rgba(251,113,133,0.12)",
                    },
                  ]}
                >
                  <Ionicons
                    name={summary.net >= 0 ? "trending-up" : "trending-down"}
                    size={16}
                    color={summary.net >= 0 ? theme.colors.success : theme.colors.danger}
                  />
                  <Text
                    style={[
                      styles.netBadgeText,
                      { color: summary.net >= 0 ? theme.colors.success : theme.colors.danger },
                    ]}
                  >
                    {formatCurrency(summary.net, currency || "USD", { signDisplay: "always" })}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStat}>
                  <Text style={styles.statLabel}>Opening balance</Text>
                  <Text style={[styles.statValue, styles.openingBalanceValue]}>
                    {formatCurrency(summary.openingBalance, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.statLabel}>Income</Text>
                  <Text style={[styles.statValue, styles.incomeText]}>
                    {formatCurrency(summary.income, currency || "USD", { signDisplay: "always" })}
                  </Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.statLabel}>Spending</Text>
                  <Text style={[styles.statValue, styles.expenseText]}>
                    {formatCurrency(-summary.expense, currency || "USD", { signDisplay: "always" })}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.reportToggle}
                onPress={() => setReportExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityState={{ expanded: reportExpanded }}
              >
                <Text style={styles.reportToggleText}>
                  {reportExpanded ? "Hide" : "View"} report for this period
                </Text>
                <Ionicons
                  name={reportExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.colors.text}
                />
              </Pressable>
              {reportExpanded && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Category breakdown</Text>
                  {expenseBreakdown.length ? (
                    expenseBreakdown.map((category) => (
                      <View key={category.category} style={styles.reportRow}>
                        <View style={styles.reportLabelBlock}>
                          <Text style={styles.reportCategory}>{category.category}</Text>
                          <Text style={styles.reportAmount}>
                            {formatCurrency(category.amount, currency || "USD")}
                          </Text>
                        </View>
                        <View style={styles.reportProgressTrack}>
                          <View
                            style={[
                              styles.reportProgressFill,
                              {
                                width: `${Math.min(100, Math.max(6, category.percentage))}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.reportPercentage}>{category.percentage}%</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.reportEmpty}>
                      No expenses logged for {periodLabel} yet.
                    </Text>
                  )}
                </View>
              )}
            </View>

            {filteredRecurring.length > 0 && (
              <View style={[theme.components.surface, styles.recurringCard]}>
                <View style={styles.recurringHeader}>
                  <Text style={styles.recurringTitle}>Recurring this period</Text>
                  <Text style={styles.recurringCaption}>{filteredRecurring.length} due</Text>
                </View>
                <View style={styles.recurringList}>
                  {filteredRecurring.map((item) => (
                    <View key={item.id} style={styles.recurringRow}>
                      <View style={styles.recurringCopy}>
                        <Text style={styles.recurringNote}>{item.note}</Text>
                        <Text style={styles.recurringMeta}>
                          {dayjs(item.nextOccurrence).format("MMM D")} • {item.frequency}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => logRecurringTransaction(item.id)}
                        style={styles.recurringAction}
                        accessibilityRole="button"
                      >
                        <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.recurringActionText}>Log</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={[theme.components.surface, styles.transactionCard]}>
            <View style={styles.transactionMain}>
              <View
                style={[
                  styles.categoryAvatar,
                  item.type === "income" ? styles.avatarIncome : styles.avatarExpense,
                ]}
              >
                <Text style={styles.avatarText}>{item.category.charAt(0)}</Text>
              </View>
              <View style={styles.transactionCopy}>
                <Text style={styles.transactionNote}>{item.note}</Text>
                <Text style={styles.transactionMeta}>
                  {item.category} • {dayjs(item.date).format("h:mm A")}
                </Text>
                {item.tags?.length ? (
                  <View style={styles.tagList}>
                    {item.tags.map((tag) => (
                      <View key={tag} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.transactionAmountBlock}>
              <Text
                style={[
                  styles.transactionAmount,
                  item.type === "income" ? styles.incomeText : styles.expenseText,
                ]}
              >
                {item.type === "income" ? "+" : "-"}
                {formatCurrency(item.amount, currency || "USD")}
              </Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="documents-outline" size={24} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Transactions that match your selected filters will appear here.
            </Text>
          </View>
        }
      />

      {showStartPicker && (
        <DateTimePicker
          value={(startDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) {
              setStartDate(dayjs(selectedDate));
            }
            if (Platform.OS !== "ios") {
              setShowStartPicker(false);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={(endDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) {
              setEndDate(dayjs(selectedDate));
            }
            if (Platform.OS !== "ios") {
              setShowEndPicker(false);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    header: {
      gap: theme.spacing.md,
    },
    headingBlock: {
      gap: theme.spacing.xs,
    },
    title: {
      ...theme.typography.title,
    },
    subtitle: {
      ...theme.typography.subtitle,
    },
    periodTabs: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xs,
      borderRadius: 999,
      alignSelf: "stretch",
    },
    periodTabsContent: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
      paddingHorizontal: theme.spacing.xs,
    },
    periodTab: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: 999,
    },
    periodTabActive: {
      backgroundColor: theme.colors.primary,
    },
    periodText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    periodTextActive: {
      color: theme.colors.text,
    },
    filtersCard: {
      ...theme.components.surface,
      gap: theme.spacing.md,
    },
    filterTitle: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    filterRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    filterColumn: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    filterLabel: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    filterInput: {
      ...theme.components.input,
      fontSize: 14,
    },
    dateButton: {
      ...theme.components.input,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateButtonText: {
      color: theme.colors.text,
      fontSize: 14,
    },
    tagsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    tagChip: {
      ...theme.components.chip,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tagText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    tagTextActive: {
      color: theme.colors.text,
    },
    clearFiltersButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryMuted,
    },
    clearFiltersText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sectionHeader: {
      ...theme.typography.label,
      marginBottom: theme.spacing.sm,
    },
    summaryCard: {
      gap: theme.spacing.md,
    },
    summaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryTitleBlock: {
      gap: 6,
    },
    summaryLabel: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    summaryValue: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    netBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    summaryStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    summaryStat: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    statLabel: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    openingBalanceValue: {
      color: theme.colors.text,
    },
    incomeText: {
      color: theme.colors.success,
    },
    expenseText: {
      color: theme.colors.danger,
    },
    reportToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    reportToggleText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    reportCard: {
      gap: theme.spacing.md,
    },
    reportTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    reportRow: {
      gap: theme.spacing.xs,
    },
    reportLabelBlock: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    reportCategory: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    reportAmount: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    reportProgressTrack: {
      height: 6,
      backgroundColor: theme.colors.border,
      borderRadius: 999,
      overflow: "hidden",
    },
    reportProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    reportPercentage: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    reportEmpty: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    transactionCard: {
      gap: theme.spacing.md,
    },
    transactionMain: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    categoryAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarIncome: {
      backgroundColor: `${theme.colors.success}33`,
    },
    avatarExpense: {
      backgroundColor: `${theme.colors.danger}33`,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionCopy: {
      flex: 1,
      gap: 4,
    },
    transactionNote: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    transactionMeta: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    tagList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    tagPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    transactionAmountBlock: {
      justifyContent: "center",
    },
    transactionAmount: {
      fontSize: 16,
      fontWeight: "600",
      textAlign: "right",
    },
    itemSeparator: {
      height: theme.spacing.md,
    },
    sectionSeparator: {
      height: theme.spacing.lg,
    },
    emptyState: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
    },
    emptyTitle: {
      ...theme.typography.title,
      fontSize: 20,
    },
    emptySubtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
      textAlign: "center",
    },
    recurringCard: {
      gap: theme.spacing.md,
    },
    recurringHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    recurringTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    recurringCaption: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    recurringList: {
      gap: theme.spacing.sm,
    },
    recurringRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    recurringCopy: {
      flex: 1,
      gap: 4,
    },
    recurringNote: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    recurringMeta: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    recurringAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    recurringActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });
