/**
 * Auto Add Review Screen
 * 
 * Displays extracted transactions for review and editing before batch saving.
 * Includes account selector, duplicate warnings, and save functionality.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAppTheme } from '../../theme';
import { useFinanceStore } from '../../lib/store';
import type { ExtractedTransaction } from '../../lib/ai-receipt-parser';
import type { DuplicateCheckResult } from '../../lib/duplicate-detection';
import { getTransactionDuplicate } from '../../lib/duplicate-detection';
import { ExtractedTransactionCard } from '../../components/transactions/ExtractedTransactionCard';

const WARNING_COLOR = '#F59E0B';

type ExtractedWithCategory = ExtractedTransaction & { 
  matchedCategory: string;
  accountId?: string;
};

export default function AutoAddReviewScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactions: string;
    duplicates: string;
    imageUri: string;
  }>();

  // Parse params
  const initialTransactions = useMemo(() => {
    try {
      return JSON.parse(params.transactions || '[]') as ExtractedWithCategory[];
    } catch {
      return [];
    }
  }, [params.transactions]);

  const duplicateResult = useMemo(() => {
    try {
      return JSON.parse(params.duplicates || '{"hasDuplicates":false,"matches":[]}') as DuplicateCheckResult;
    } catch {
      return { hasDuplicates: false, matches: [] };
    }
  }, [params.duplicates]);

  // Store
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const profile = useFinanceStore((state) => state.profile);

  // State
  const [transactions, setTransactions] = useState<ExtractedWithCategory[]>(initialTransactions);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts.find(a => !a.isArchived)?.id || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const currency = useMemo(() => {
    const account = accounts.find(a => a.id === selectedAccountId);
    return account?.currency || profile.currency || 'USD';
  }, [accounts, selectedAccountId, profile.currency]);

  const activeAccounts = useMemo(() => 
    accounts.filter(a => !a.isArchived),
    [accounts]
  );

  const totalAmount = useMemo(() => {
    return transactions.reduce((sum, t) => {
      return t.type === 'expense' ? sum - t.amount : sum + t.amount;
    }, 0);
  }, [transactions]);

  const formattedTotal = useMemo(() => {
    const absTotal = Math.abs(totalAmount);
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(absTotal);
    return totalAmount >= 0 ? `+${formatted}` : `-${formatted}`;
  }, [totalAmount, currency]);

  const duplicateCount = useMemo(() => {
    return transactions.filter(t => 
      getTransactionDuplicate(t.id, duplicateResult)
    ).length;
  }, [transactions, duplicateResult]);

  const handleUpdateTransaction = useCallback((
    id: string, 
    updates: Partial<ExtractedWithCategory>
  ) => {
    setTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  }, []);

  const handleDeleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!selectedAccountId) {
      Alert.alert('Select Account', 'Please select an account to save transactions to.');
      return;
    }

    if (transactions.length === 0) {
      Alert.alert('No Transactions', 'There are no transactions to save.');
      return;
    }

    // Warn about duplicates
    if (duplicateCount > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Possible Duplicates',
          `${duplicateCount} transaction(s) may already exist. Do you want to save anyway?`,
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Save Anyway', onPress: () => resolve(true) },
          ]
        );
      });
      if (!confirmed) return;
    }

    setIsSaving(true);

    try {
      let savedCount = 0;

      for (const transaction of transactions) {
        const accountId = transaction.accountId || selectedAccountId;
        
        // Ensure we have a valid accountId
        if (!accountId) {
          console.error('[AutoAdd] No accountId for transaction:', transaction);
          continue;
        }
        
        console.log('[AutoAdd] Saving transaction:', {
          amount: transaction.amount,
          note: transaction.note,
          type: transaction.type,
          category: transaction.matchedCategory,
          date: transaction.date,
          accountId,
        });
        
        await addTransaction({
          amount: transaction.amount,
          note: transaction.note,
          type: transaction.type,
          category: transaction.matchedCategory,
          date: transaction.date,
          accountId: accountId!,
        });
        savedCount++;
      }

      // Show success and navigate
      Alert.alert(
        'Success!',
        `${savedCount} transaction${savedCount !== 1 ? 's' : ''} saved successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.dismissAll();
              router.replace('/(tabs)/transactions');
            },
          },
        ]
      );
    } catch (error) {
      console.error('[AutoAdd] Save error:', error);
      Alert.alert('Error', 'Failed to save some transactions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [selectedAccountId, transactions, duplicateCount, addTransaction, router]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  if (transactions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Review Transactions</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No Transactions</Text>
          <Text style={styles.emptyText}>
            All transactions have been removed. Go back to scan another image.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.back()}>
            <Text style={styles.emptyButtonText}>Scan Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Review Transactions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Transactions</Text>
              <Text style={styles.summaryValue}>{transactions.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net Total</Text>
              <Text style={[
                styles.summaryValue,
                totalAmount >= 0 ? styles.summaryPositive : styles.summaryNegative
              ]}>
                {formattedTotal}
              </Text>
            </View>
          </View>
          {duplicateCount > 0 && (
            <View style={styles.duplicateWarning}>
              <Ionicons name="warning" size={18} color={WARNING_COLOR} />
              <Text style={styles.duplicateWarningText}>
                {duplicateCount} possible duplicate{duplicateCount !== 1 ? 's' : ''} detected
              </Text>
            </View>
          )}
        </View>

        {/* Account Selector */}
        <View style={styles.accountSection}>
          <Text style={styles.sectionLabel}>Import to Account</Text>
          <Pressable 
            style={styles.accountSelector}
            onPress={() => setShowAccountPicker(!showAccountPicker)}
          >
            <View style={styles.accountInfo}>
              <Ionicons name="wallet" size={20} color={theme.colors.primary} />
              <Text style={styles.accountName}>
                {selectedAccount?.name || 'Select account'}
              </Text>
            </View>
            <Ionicons 
              name={showAccountPicker ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={theme.colors.textMuted} 
            />
          </Pressable>
          
          {showAccountPicker && (
            <View style={styles.accountPickerDropdown}>
              {activeAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  style={[
                    styles.accountOption,
                    account.id === selectedAccountId && styles.accountOptionActive
                  ]}
                  onPress={() => {
                    setSelectedAccountId(account.id);
                    setShowAccountPicker(false);
                  }}
                >
                  <Text style={[
                    styles.accountOptionText,
                    account.id === selectedAccountId && styles.accountOptionTextActive
                  ]}>
                    {account.name}
                  </Text>
                  <Text style={styles.accountOptionType}>{account.type}</Text>
                  {account.id === selectedAccountId && (
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.accountHint}>
            You can override this for individual transactions by tapping to expand
          </Text>
        </View>

        {/* Transactions List */}
        <View style={styles.transactionsList}>
          <Text style={styles.sectionLabel}>
            Extracted Transactions ({transactions.length})
          </Text>
          {transactions.map((transaction) => (
            <ExtractedTransactionCard
              key={transaction.id}
              transaction={transaction}
              duplicateMatch={getTransactionDuplicate(transaction.id, duplicateResult)}
              categories={categories}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              currency={currency}
              onUpdate={handleUpdateTransaction}
              onDelete={handleDeleteTransaction}
            />
          ))}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveAll}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                Save {transactions.length} Transaction{transactions.length !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl + 96 + insets.bottom,
      gap: theme.screen.isSmallDevice ? theme.spacing.md : theme.spacing.lg,
    },
    summaryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    summaryLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
    },
    summaryPositive: {
      color: theme.colors.success,
    },
    summaryNegative: {
      color: theme.colors.danger,
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
    },
    duplicateWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: `${WARNING_COLOR}15`,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
    },
    duplicateWarningText: {
      fontSize: 13,
      color: WARNING_COLOR,
      fontWeight: '500',
    },
    accountSection: {
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    accountSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    accountInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    accountName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    accountPickerDropdown: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    accountOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    accountOptionActive: {
      backgroundColor: `${theme.colors.primary}10`,
    },
    accountOptionText: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    accountOptionTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    accountOptionType: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textTransform: 'capitalize',
    },
    accountHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontStyle: 'italic',
    },
    transactionsList: {
      gap: theme.spacing.md,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.lg + insets.bottom,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.spacing.md,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.pill,
      marginTop: theme.spacing.md,
    },
    emptyButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
    },
  });
