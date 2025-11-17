import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { filterTransactionsByAccount, getTransactionDelta, getTransactionVisualState } from "../../lib/transactions";
import { useFinanceStore, type Transaction } from "../../lib/store";

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  }).format(value);

export default function NetIncomeWeekScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { start: startParam, end: endParam, accountId } =
    useLocalSearchParams<{ start?: string; end?: string; accountId?: string }>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const baseCurrency = currency || "USD";
  const visibleAccounts = useMemo(
    () => accounts.filter((account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency),
    [accounts, baseCurrency],
  );
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const parsedStart = dayjs(startParam ?? undefined);
  const parsedEnd = dayjs(endParam ?? undefined);
  const startDate = parsedStart.isValid() ? parsedStart.startOf("day") : dayjs().startOf("week");
  const endDate = parsedEnd.isValid() ? parsedEnd.endOf("day") : startDate.endOf("week");

  const selectedAccountId = typeof accountId === "string" && accountId.length ? accountId : null;
  const selectedAccountName = useMemo(() => {
    if (!selectedAccountId) return "All accounts";
    return accounts.find((account) => account.id === selectedAccountId)?.name ?? "Selected account";
  }, [accounts, selectedAccountId]);

  const scopedTransactions = useMemo(() => {
    const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);

    return filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
      if (!allowedAccountIds || allowedAccountIds.size === 0) return true;
      const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
      const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;
      return fromAllowed || toAllowed;
    });
  }, [selectedAccountId, transactions, visibleAccountIds]);

  const weeklyTransactions = useMemo(
    () =>
      scopedTransactions
        .filter((transaction) => {
          const date = dayjs(transaction.date);
          return (
            !transaction.excludeFromReports && !date.isBefore(startDate.startOf("day")) && !date.isAfter(endDate.endOf("day"))
          );
        })
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()),
    [endDate, scopedTransactions, startDate],
  );

  const totals = useMemo(
    () =>
      weeklyTransactions.reduce(
        (acc, transaction) => {
          if (transaction.type === "income") acc.income += transaction.amount;
          if (transaction.type === "expense") acc.expense += transaction.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [weeklyTransactions],
  );

  const net = useMemo(
    () => weeklyTransactions.reduce((acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId), 0),
    [selectedAccountId, weeklyTransactions],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();

    weeklyTransactions.forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      const bucket = map.get(key) ?? [];
      bucket.push(transaction);
      map.set(key, bucket);
    });

    return Array.from(map.entries())
      .sort((a, b) => dayjs(b[0]).valueOf() - dayjs(a[0]).valueOf())
      .map(([dateKey, bucket]) => ({
        date: dayjs(dateKey),
        transactions: bucket,
      }));
  }, [weeklyTransactions]);

  const resultCount = weeklyTransactions.length;
  const dateLabel = `${startDate.format("MMM D, YYYY")} – ${endDate.format("MMM D, YYYY")}`;

  const renderTransaction = (transaction: Transaction) => {
    const visual = getTransactionVisualState(transaction, selectedAccountId);
    const amountColor =
      visual.variant === "income"
        ? theme.colors.success
        : visual.variant === "expense"
          ? theme.colors.danger
          : theme.colors.text;

    return (
      <Pressable
        key={transaction.id}
        style={styles.transactionRow}
        onPress={() => router.push(`/transactions/${transaction.id}`)}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: `${theme.colors.primary}16` }]}>
          <Ionicons name="pricetag" size={16} color={theme.colors.primary} />
        </View>
        <View style={styles.transactionMeta}>
          <Text style={styles.transactionTitle}>{transaction.category}</Text>
          <Text style={styles.transactionNote} numberOfLines={1}>
            {transaction.note || "No note"}
          </Text>
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[styles.amountText, { color: amountColor }]}>
            {formatCurrency(transaction.amount, currency, { signDisplay: "never" })}
          </Text>
          <Text style={styles.amountPrefix}>{visual.prefix}</Text>
        </View>
      </Pressable>
    );
  };

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
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>{dateLabel}</Text>
          <Text style={styles.headerSubtitle}>{selectedAccountName}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Results</Text>
            <Text style={styles.summaryValue}>{resultCount} result{resultCount === 1 ? "" : "s"}</Text>
          </View>
          <View style={styles.summaryTotals}>
            <View>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.success }]}> 
                {formatCurrency(totals.income, currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Expense</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.danger }]}> 
                {formatCurrency(totals.expense, currency)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={[styles.summaryValue, { color: net >= 0 ? theme.colors.success : theme.colors.danger }]}> 
                {formatCurrency(net, currency, { signDisplay: "always" })}
              </Text>
            </View>
          </View>
        </View>

        {grouped.map((group) => (
          <View key={group.date.format("YYYY-MM-DD")}> 
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeDay}>{group.date.format("DD")}</Text>
                <Text style={styles.dayBadgeMonth}>{group.date.format("MMM YYYY")}</Text>
              </View>
              <View style={styles.dayMeta}>
                <Text style={styles.dayTitle}>{group.date.format("dddd")}</Text>
                <Text style={styles.daySubtitle}>{group.date.format("MMMM D, YYYY")}</Text>
              </View>
            </View>
            <View style={styles.transactionCard}>{group.transactions.map(renderTransaction)}</View>
          </View>
        ))}

        {!grouped.length && (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline" size={28} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>No transactions found for this week.</Text>
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
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerMeta: {
      flex: 1,
      marginHorizontal: theme.spacing.md,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + 16,
      gap: theme.spacing.md,
    },
    summaryCard: {
      ...theme.components.card,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.lg,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
    },
    summaryTotals: {
      flexDirection: "row",
      gap: theme.spacing.lg,
      alignItems: "flex-end",
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    dayBadge: {
      width: 64,
      paddingVertical: 10,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      borderWidth: 1,
      borderColor: `${theme.colors.border}70`,
    },
    dayBadgeDay: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
    },
    dayBadgeMonth: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    dayMeta: {
      flex: 1,
    },
    dayTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    daySubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    transactionCard: {
      ...theme.components.card,
      paddingVertical: theme.spacing.sm,
      gap: 6,
    },
    transactionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    transactionMeta: {
      flex: 1,
      gap: 2,
    },
    transactionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionNote: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    transactionAmount: {
      alignItems: "flex-end",
      minWidth: 96,
    },
    amountText: {
      fontSize: 15,
      fontWeight: "800",
    },
    amountPrefix: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    emptyState: {
      ...theme.components.card,
      alignItems: "center",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    emptyText: {
      color: theme.colors.textMuted,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${theme.colors.border}80`,
    },
  });
