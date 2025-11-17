import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { Transaction, useFinanceStore } from "../../lib/store";
import { filterTransactionsByAccount, getTransactionDelta, getTransactionVisualState } from "../../lib/transactions";

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

const groupTransactionsByDay = (transactions: Transaction[]) => {
  const map = new Map<string, Transaction[]>();

  transactions.forEach((transaction) => {
    const key = dayjs(transaction.date).format("YYYY-MM-DD");
    map.set(key, [...(map.get(key) ?? []), transaction]);
  });

  return Array.from(map.entries())
    .map(([date, items]) => ({ date: dayjs(date), items }))
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
};

export default function NetIncomeWeekScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { start: startParam, end: endParam, accountId, periodLabel, weekLabel } =
    useLocalSearchParams<{
      start?: string;
      end?: string;
      accountId?: string;
      periodLabel?: string;
      weekLabel?: string;
    }>();

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const parsedStart = useMemo(() => dayjs(String(startParam)), [startParam]);
  const parsedEnd = useMemo(() => dayjs(String(endParam)), [endParam]);
  const start = parsedStart.isValid() ? parsedStart.startOf("day") : dayjs().startOf("day");
  const end = parsedEnd.isValid() ? parsedEnd.endOf("day") : start.endOf("week");
  const selectedAccountId = typeof accountId === "string" && accountId.length ? accountId : null;

  const baseCurrency = currency || "USD";
  const visibleAccounts = useMemo(
    () => accounts.filter((account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency),
    [accounts, baseCurrency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

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

  const grouped = useMemo(() => groupTransactionsByDay(withinRange), [withinRange]);
  const incomeTotal = withinRange
    .filter((transaction) => transaction.type === "income")
    .reduce((acc, transaction) => acc + transaction.amount, 0);
  const expenseTotal = withinRange
    .filter((transaction) => transaction.type === "expense")
    .reduce((acc, transaction) => acc + transaction.amount, 0);
  const net = withinRange.reduce((acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId), 0);

  const headerRange = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
  const effectiveWeekLabel = typeof weekLabel === "string" ? weekLabel : "This week";
  const periodCaption = typeof periodLabel === "string" ? periodLabel : "Selected period";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close week breakdown"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.title}>{headerRange}</Text>
          <Text style={styles.subtitle}>{`${periodCaption} • Week ${effectiveWeekLabel}`}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.incomeCard]}> 
            <View style={styles.summaryLabelRow}>
              <Ionicons name="arrow-up" size={16} color={theme.colors.success} />
              <Text style={styles.summaryLabel}>Income</Text>
            </View>
            <Text style={styles.summaryValue(theme.colors.success)}>{formatCurrency(incomeTotal, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.expenseCard]}> 
            <View style={styles.summaryLabelRow}>
              <Ionicons name="arrow-down" size={16} color={theme.colors.danger} />
              <Text style={styles.summaryLabel}>Expenses</Text>
            </View>
            <Text style={styles.summaryValue(theme.colors.danger)}>{formatCurrency(expenseTotal, currency)}</Text>
          </View>
        </View>

        <View style={[styles.summaryCard, styles.netCard]}>
          <View style={styles.netHeader}>
            <Text style={styles.netTitle}>Net change</Text>
            <View style={[styles.netBadge, net >= 0 ? styles.netPositive : styles.netNegative]}>
              <Ionicons
                name={net >= 0 ? "trending-up" : "trending-down"}
                size={16}
                color={net >= 0 ? theme.colors.success : theme.colors.danger}
              />
              <Text style={styles.netBadgeText(net >= 0)}>{net >= 0 ? "Positive" : "Negative"}</Text>
            </View>
          </View>
          <Text style={styles.netValue(net >= 0)}>{formatCurrency(net, currency, { signDisplay: "always" })}</Text>
          <Text style={styles.netHint}>Showing transactions between the selected dates.</Text>
        </View>

        {grouped.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={26} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions for this week</Text>
            <Text style={styles.emptySubtitle}>Add an income or expense to see it here.</Text>
          </View>
        ) : (
          <View style={styles.dayList}>
            {grouped.map((group) => (
              <View key={group.date.toISOString()} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayNumber}>{group.date.format("DD")}</Text>
                    <Text style={styles.dayMonth}>{group.date.format("MMM YYYY")}</Text>
                  </View>
                  <Text style={styles.dayWeekday}>{group.date.format("dddd")}</Text>
                </View>

                {group.items.map((transaction) => {
                  const { prefix, variant } = getTransactionVisualState(transaction, selectedAccountId);
                  const amountColor =
                    variant === "income"
                      ? theme.colors.success
                      : variant === "expense"
                        ? theme.colors.danger
                        : theme.colors.text;

                  return (
                    <View key={transaction.id} style={styles.transactionRow}>
                      <View
                        style={[
                          styles.iconCircle,
                          variant === "income"
                            ? styles.iconIncome
                            : variant === "expense"
                              ? styles.iconExpense
                              : styles.iconNeutral,
                        ]}
                      >
                        <Ionicons
                          name={transaction.type === "income" ? "cash-outline" : "card-outline"}
                          size={16}
                          color={variant === "expense" ? theme.colors.danger : theme.colors.success}
                        />
                      </View>
                      <View style={styles.transactionMeta}>
                        <Text style={styles.transactionTitle} numberOfLines={1}>
                          {transaction.note || transaction.category || "Transaction"}
                        </Text>
                        <Text style={styles.transactionSubtitle} numberOfLines={1}>
                          {transaction.category || "Uncategorized"}
                        </Text>
                      </View>
                      <Text style={[styles.transactionAmount, { color: amountColor }]}> 
                        {prefix}
                        {formatCurrency(transaction.amount, currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
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
      fontSize: 18,
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
    summaryRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    summaryCard: {
      flex: 1,
      padding: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}08`,
      gap: theme.spacing.sm,
    },
    incomeCard: {
      backgroundColor: `${theme.colors.success}12`,
      borderColor: `${theme.colors.success}25`,
    },
    expenseCard: {
      backgroundColor: `${theme.colors.danger}12`,
      borderColor: `${theme.colors.danger}25`,
    },
    summaryLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    summaryValue: (color: string) => ({
      fontSize: 24,
      fontWeight: "700",
      color,
    }),
    netCard: {
      ...theme.components.card,
      borderRadius: theme.radii.lg,
      gap: 6,
    },
    netHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    netTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radii.md,
    },
    netPositive: {
      backgroundColor: `${theme.colors.success}18`,
    },
    netNegative: {
      backgroundColor: `${theme.colors.danger}18`,
    },
    netBadgeText: (positive: boolean) => ({
      fontSize: 12,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    netValue: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    netHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    dayList: {
      gap: theme.spacing.md,
    },
    dayCard: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}08`,
      gap: theme.spacing.md,
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dayBadge: {
      backgroundColor: theme.colors.surfaceElevated,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}12`,
    },
    dayNumber: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    dayMonth: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    dayWeekday: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    iconIncome: {
      backgroundColor: `${theme.colors.success}18`,
    },
    iconExpense: {
      backgroundColor: `${theme.colors.danger}18`,
    },
    iconNeutral: {
      backgroundColor: `${theme.colors.textMuted}18`,
    },
    transactionMeta: {
      flex: 1,
      minWidth: 0,
    },
    transactionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    transactionAmount: {
      fontSize: 15,
      fontWeight: "700",
      textAlign: "right",
    },
    emptyState: {
      ...theme.components.card,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: theme.spacing.xl,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
  });
