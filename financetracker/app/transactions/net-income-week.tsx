import { useMemo } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs, { Dayjs } from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { Transaction, useFinanceStore } from "../../lib/store";
import { filterTransactionsByAccount, getTransactionDelta, getTransactionVisualState } from "../../lib/transactions";

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

interface SectionItem {
  title: string;
  date: Dayjs;
  data: Transaction[];
}

export default function NetIncomeWeekDetailsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const router = useRouter();
  const { start: startParam, end: endParam, label, accountId } = useLocalSearchParams<{
    start?: string;
    end?: string;
    label?: string;
    accountId?: string;
  }>();

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const visibleAccounts = useMemo(() => accounts.filter((account) => !account.excludeFromTotal), [accounts]);
  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const selectedAccountId = useMemo(() => {
    if (typeof accountId === "string" && accountId.length) {
      return accountId;
    }
    return null;
  }, [accountId]);

  const selectedAccount = useMemo(
    () => (selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) : null),
    [accounts, selectedAccountId],
  );

  const start = useMemo(() => (typeof startParam === "string" ? dayjs(startParam) : dayjs()), [startParam]);
  const end = useMemo(() => (typeof endParam === "string" ? dayjs(endParam) : start), [endParam, start]);

  const scopedTransactions = useMemo(() => {
    const allowedAccountIds = selectedAccountId ? null : new Set(visibleAccountIds);

    return filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
      if (transaction.excludeFromReports) {
        return false;
      }

      if (allowedAccountIds && allowedAccountIds.size > 0) {
        const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
        const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

        if (!fromAllowed && !toAllowed) {
          return false;
        }
      }

      const date = dayjs(transaction.date);
      return !date.isBefore(start) && !date.isAfter(end);
    });
  }, [end, selectedAccountId, start, transactions, visibleAccountIds]);

  const groupedSections = useMemo<SectionItem[]>(() => {
    const map = new Map<string, SectionItem>();

    scopedTransactions.forEach((transaction) => {
      const date = dayjs(transaction.date).startOf("day");
      const key = date.format("YYYY-MM-DD");
      if (!map.has(key)) {
        map.set(key, { title: date.format("dddd"), date, data: [] });
      }
      map.get(key)?.data.push(transaction);
    });

    return Array.from(map.values()).sort((a, b) => b.date.valueOf() - a.date.valueOf());
  }, [scopedTransactions]);

  const totals = useMemo(() => {
    return scopedTransactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else if (transaction.type === "expense") {
          acc.expense += transaction.amount;
        }
        acc.net += getTransactionDelta(transaction, selectedAccountId);
        return acc;
      },
      { income: 0, expense: 0, net: 0 },
    );
  }, [scopedTransactions, selectedAccountId]);

  const accountLabel = selectedAccount ? selectedAccount.name : "All accounts";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>{label ?? "Weekly transactions"}</Text>
          <Text style={styles.headerSubtitle}>
            {start.format("MMM D")} – {end.format("MMM D, YYYY")} · {accountLabel}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={styles.summaryValue(theme.colors.success)}>{formatCurrency(totals.income, currency)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expense</Text>
          <Text style={styles.summaryValue(theme.colors.danger)}>{formatCurrency(totals.expense, currency)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={styles.summaryValue(totals.net >= 0 ? theme.colors.success : theme.colors.danger)}>
            {formatCurrency(totals.net, currency, { signDisplay: "always" })}
          </Text>
        </View>
      </View>

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing for this week</Text>
            <Text style={styles.emptySubtitle}>
              Try logging a transaction between {start.format("MMM D")} and {end.format("MMM D")}.
            </Text>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDate}>
              <Text style={styles.sectionDay}>{section.date.format("DD")}</Text>
              <Text style={styles.sectionMonth}>{section.date.format("MMM")}</Text>
            </View>
            <View style={styles.sectionMeta}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>{section.date.format("MMMM YYYY")}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const visual = getTransactionVisualState(item, selectedAccountId);
          const isTransfer = item.type === "transfer";
          const secondaryLine = isTransfer
            ? `${resolveAccountName(item.accountId)} → ${resolveAccountName(item.toAccountId)}`
            : item.note.trim().length
              ? item.note
              : item.category;

          return (
            <Pressable
              style={styles.transactionRow}
              onPress={() => router.push(`/transactions/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open transaction ${item.category}`}
            >
              <View
                style={[
                  styles.avatar,
                  visual.variant === "income"
                    ? styles.avatarIncome
                    : visual.variant === "expense"
                      ? styles.avatarExpense
                      : styles.avatarNeutral,
                ]}
              >
                <Text style={styles.avatarText}>{item.category.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.transactionMeta}>
                <Text style={styles.transactionCategory}>{item.category}</Text>
                <Text style={styles.transactionNote} numberOfLines={1}>
                  {secondaryLine}
                </Text>
              </View>
              <Text style={styles.transactionAmount(visual.variant)}>
                {`${visual.prefix}${formatCurrency(item.amount, currency)}`}
              </Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.itemDivider} />}
        SectionSeparatorComponent={() => <View style={styles.sectionDivider} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme, insets: { bottom: number }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    headerMeta: { flex: 1, gap: 2 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    headerSpacer: { width: 40 },
    summaryRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.md,
    },
    summaryItem: {
      flex: 1,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      gap: 6,
    },
    summaryLabel: {
      fontSize: 12,
      letterSpacing: 0.8,
      color: theme.colors.textMuted,
    },
    summaryValue: (color: string) => ({
      fontSize: 18,
      fontWeight: "700",
      color,
    }),
    listContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      gap: theme.spacing.md,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionDate: {
      width: 54,
      height: 54,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionDay: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
    },
    sectionMonth: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    sectionMeta: { gap: 2 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    transactionRow: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceElevated,
    },
    avatarIncome: { backgroundColor: `${theme.colors.success}22` },
    avatarExpense: { backgroundColor: `${theme.colors.danger}22` },
    avatarNeutral: { backgroundColor: `${theme.colors.primary}18` },
    avatarText: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
    },
    transactionMeta: { flex: 1, gap: 4 },
    transactionCategory: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionNote: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    transactionAmount: (variant: "income" | "expense" | "neutral") => ({
      fontSize: 16,
      fontWeight: "700",
      color:
        variant === "income"
          ? theme.colors.success
          : variant === "expense"
            ? theme.colors.danger
            : theme.colors.text,
    }),
    itemDivider: {
      height: theme.spacing.sm,
    },
    sectionDivider: {
      height: theme.spacing.lg,
    },
    emptyState: {
      paddingVertical: theme.spacing.xl,
      alignItems: "center",
      gap: 6,
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

const resolveAccountName = (id?: string | null) => {
  const accounts = useFinanceStore.getState().accounts;
  const match = accounts.find((account) => account.id === id);
  return match?.name ?? "Unknown account";
};
