import { useMemo, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { doesCategoryMatchBudget } from "../../lib/categoryUtils";
import { sortTransactionsByRecency } from "../../lib/transactions";
import { formatDate } from "../../lib/text";

const toIconName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export default function BudgetDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const currency = useFinanceStore((state) => state.profile.currency);
  const dateFormat = useFinanceStore((state) => state.preferences.dateFormat);
  const accounts = useFinanceStore((state) => state.accounts);
  const removeBudgetGoal = useFinanceStore((state) => state.removeBudgetGoal);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const budget = budgetGoals.find((g) => g.id === id);

  // Calculate period dates
  const { periodStart, periodEnd, matchingTransactions, spending, progress, isOverBudget } = useMemo(() => {
    if (!budget) {
      return {
        periodStart: new Date(),
        periodEnd: new Date(),
        matchingTransactions: [],
        spending: 0,
        progress: 0,
        isOverBudget: false,
      };
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    if (budget.period === 'week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start = new Date(now);
      start.setDate(now.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const matching = transactions.filter(t => {
      const txDate = new Date(t.date);
      const inDateRange = txDate >= start && txDate <= end;
      const isExpense = t.type === 'expense';
      const matchesCategory = doesCategoryMatchBudget(t.category, budget.category, categories);
      
      return isExpense && matchesCategory && inDateRange;
    });

    const totalSpending = matching.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const progressPercent = budget.target > 0 ? Math.min((totalSpending / budget.target) * 100, 100) : 0;
    const over = totalSpending > budget.target;

    return {
      periodStart: start,
      periodEnd: end,
      matchingTransactions: matching.sort(sortTransactionsByRecency),
      spending: totalSpending,
      progress: Math.round(progressPercent),
      isOverBudget: over,
    };
  }, [budget, transactions, categories]);

  const handleDelete = () => {
    if (!budget) return;
    
    Alert.alert(
      "Delete Budget",
      `Are you sure you want to delete "${budget.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            removeBudgetGoal(budget.id);
            router.back();
          },
        },
      ]
    );
  };

  if (!budget) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Budget Not Found</Text>
        </View>
        <View style={styles.notFoundContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textMuted} />
          <Text style={styles.notFoundText}>This budget could not be found</Text>
          <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
            <Text style={styles.notFoundButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const category = categories.find(c => c.name === budget.category || c.id === budget.category);
  const remaining = Math.max(budget.target - spending, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Budget Details</Text>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Budget Overview Card */}
        <View style={[theme.components.surface, styles.overviewCard]}>
          <View style={styles.budgetHeader}>
            <View style={styles.budgetIcon}>
              <Ionicons
                name={toIconName(category?.icon)}
                size={32}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.budgetTitleSection}>
              <Text style={styles.budgetName}>{budget.name}</Text>
              <View style={styles.budgetMeta}>
                <View style={styles.metaBadge}>
                  <Ionicons name="pricetag" size={12} color={theme.colors.textMuted} />
                  <Text style={styles.metaText}>{budget.category}</Text>
                </View>
                <Text style={styles.metaDivider}>•</Text>
                <View style={styles.metaBadge}>
                  <Ionicons name="calendar" size={12} color={theme.colors.textMuted} />
                  <Text style={styles.metaText}>{budget.period}ly</Text>
                </View>
                {budget.isRepeating && (
                  <>
                    <Text style={styles.metaDivider}>•</Text>
                    <View style={styles.metaBadge}>
                      <Ionicons name="repeat" size={12} color={theme.colors.textMuted} />
                      <Text style={styles.metaText}>Repeating</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Period Info */}
          <View style={styles.periodInfo}>
            <Text style={styles.periodLabel}>Current Period</Text>
            <Text style={styles.periodText}>
              {dayjs(periodStart).format('MMM D')} - {dayjs(periodEnd).format('MMM D, YYYY')}
            </Text>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.spendingText}>
                {currency}{spending.toFixed(2)}
              </Text>
              <Text style={styles.targetText}>
                of {currency}{budget.target.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress, 100)}%` },
                  isOverBudget ? styles.progressFillOver : styles.progressFillGood
                ]} 
              />
            </View>

            <View style={styles.progressFooter}>
              <Text style={[styles.progressPercentage, isOverBudget && styles.progressPercentageOver]}>
                {progress}%
              </Text>
              {isOverBudget ? (
                <View style={styles.warningBadge}>
                  <Ionicons name="warning" size={14} color={theme.colors.danger} />
                  <Text style={styles.warningText}>
                    Over by {currency}{(spending - budget.target).toFixed(2)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.remainingText}>
                  {currency}{remaining.toFixed(2)} remaining
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Transactions List */}
        <View style={[theme.components.surface, styles.transactionsCard]}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{matchingTransactions.length}</Text>
            </View>
          </View>

          {matchingTransactions.length > 0 ? (
            <View style={styles.transactionsList}>
              {matchingTransactions.map((transaction) => {
                const txCategory = categories.find(c => c.id === transaction.category);
                const account = accounts.find(a => a.id === transaction.accountId);
                
                return (
                  <Pressable
                    key={transaction.id}
                    style={styles.transactionRow}
                    onPress={() => router.push(`/transactions/${transaction.id}`)}
                  >
                    <View style={styles.transactionIcon}>
                      <Ionicons
                        name={toIconName(txCategory?.icon)}
                        size={20}
                        color={theme.colors.text}
                      />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionNote}>
                        {transaction.note || 'No description'}
                      </Text>
                      <View style={styles.transactionMeta}>
                        <Text style={styles.transactionDate}>
                          {formatDate(transaction.date, dateFormat)}
                        </Text>
                        {account && (
                          <>
                            <Text style={styles.metaDivider}>•</Text>
                            <Text style={styles.transactionAccount}>{account.name}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Text style={styles.transactionAmount}>
                      {currency}{transaction.amount.toFixed(2)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyTransactions}>
              <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Transactions in the {budget.category} category will appear here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: theme.spacing.xs,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginLeft: theme.spacing.sm,
    },
    deleteButton: {
      padding: theme.spacing.xs,
    },
    content: {
      flexGrow: 1,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    notFoundContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
    },
    notFoundText: {
      fontSize: 16,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    notFoundButton: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      marginTop: theme.spacing.md,
    },
    notFoundButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    overviewCard: {
      gap: theme.spacing.md,
    },
    budgetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    budgetIcon: {
      width: 64,
      height: 64,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    budgetTitleSection: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    budgetName: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    budgetMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    metaDivider: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    periodInfo: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      gap: 4,
    },
    periodLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    periodText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    progressSection: {
      gap: theme.spacing.sm,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
    },
    spendingText: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
    },
    targetText: {
      fontSize: 16,
      color: theme.colors.textMuted,
    },
    progressBar: {
      height: 12,
      backgroundColor: theme.colors.border,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: theme.radii.pill,
    },
    progressFillGood: {
      backgroundColor: theme.colors.success,
    },
    progressFillOver: {
      backgroundColor: theme.colors.danger,
    },
    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressPercentage: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.success,
    },
    progressPercentageOver: {
      color: theme.colors.danger,
    },
    remainingText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    warningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      backgroundColor: `${theme.colors.danger}15`,
      borderRadius: theme.radii.sm,
    },
    warningText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.danger,
    },
    transactionsCard: {
      minHeight: 200,
    },
    transactionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    countBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      backgroundColor: theme.colors.primary + '22',
      borderRadius: theme.radii.pill,
    },
    countText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    transactionsList: {
      gap: theme.spacing.xs,
    },
    transactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    transactionIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    transactionInfo: {
      flex: 1,
      gap: 4,
    },
    transactionNote: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.text,
    },
    transactionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    transactionDate: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    transactionAccount: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    transactionAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.danger,
    },
    emptyTransactions: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xxl,
      gap: theme.spacing.sm,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: 'center',
      maxWidth: 280,
    },
  });
