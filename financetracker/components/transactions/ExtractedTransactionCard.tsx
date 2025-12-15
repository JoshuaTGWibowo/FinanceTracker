/**
 * Extracted Transaction Card Component
 * 
 * Displays a single extracted transaction with edit/delete capabilities.
 * Shows duplicate warning if detected.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';

import { useAppTheme } from '../../theme';
import type { ExtractedTransaction } from '../../lib/ai-receipt-parser';
import type { DuplicateMatch } from '../../lib/duplicate-detection';
import type { Category, Account } from '../../lib/types';

const WARNING_COLOR = '#F59E0B';

interface ExtractedTransactionCardProps {
  transaction: ExtractedTransaction & { matchedCategory: string };
  duplicateMatch?: DuplicateMatch;
  categories: Category[];
  accounts: Account[];
  selectedAccountId: string | null;
  currency: string;
  onUpdate: (id: string, updates: Partial<ExtractedTransaction & { matchedCategory: string; accountId?: string }>) => void;
  onDelete: (id: string) => void;
}

export function ExtractedTransactionCard({
  transaction,
  duplicateMatch,
  categories,
  accounts,
  selectedAccountId,
  currency,
  onUpdate,
  onDelete,
}: ExtractedTransactionCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  
  const [editAmount, setEditAmount] = useState(transaction.amount.toString());
  const [editNote, setEditNote] = useState(transaction.note);

  const hasDuplicate = !!duplicateMatch;
  const confidencePercent = Math.round(transaction.confidence * 100);

  const formattedAmount = useMemo(() => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(transaction.amount);
  }, [transaction.amount, currency]);

  const formattedDate = useMemo(() => {
    return dayjs(transaction.date).format('MMM D, YYYY');
  }, [transaction.date]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleAmountBlur = useCallback(() => {
    const parsed = parseFloat(editAmount.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      onUpdate(transaction.id, { amount: parsed });
    } else {
      setEditAmount(transaction.amount.toString());
    }
  }, [editAmount, onUpdate, transaction.id, transaction.amount]);

  const handleNoteBlur = useCallback(() => {
    if (editNote.trim()) {
      onUpdate(transaction.id, { note: editNote.trim() });
    } else {
      setEditNote(transaction.note);
    }
  }, [editNote, onUpdate, transaction.id, transaction.note]);

  const handleDateChange = useCallback((_event: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      onUpdate(transaction.id, { date: selectedDate.toISOString().split('T')[0] });
    }
  }, [onUpdate, transaction.id]);

  const handleCategorySelect = useCallback((categoryName: string) => {
    onUpdate(transaction.id, { matchedCategory: categoryName });
    setShowCategoryPicker(false);
  }, [onUpdate, transaction.id]);

  const handleAccountSelect = useCallback((accountId: string) => {
    onUpdate(transaction.id, { accountId });
    setShowAccountPicker(false);
  }, [onUpdate, transaction.id]);

  const handleTypeToggle = useCallback(() => {
    const newType = transaction.type === 'expense' ? 'income' : 'expense';
    onUpdate(transaction.id, { type: newType });
  }, [onUpdate, transaction.id, transaction.type]);

  const handleDelete = useCallback(() => {
    onDelete(transaction.id);
  }, [onDelete, transaction.id]);

  // Get current account name
  const currentAccount = accounts.find(a => 
    a.id === (transaction as unknown as { accountId?: string }).accountId || 
    a.id === selectedAccountId
  );
  const accountName = currentAccount?.name || 'Select account';

  // Filter categories by type
  const relevantCategories = useMemo(() => {
    return categories.filter(c => 
      (transaction.type === 'expense' && c.type === 'expense') ||
      (transaction.type === 'income' && c.type === 'income')
    );
  }, [categories, transaction.type]);

  return (
    <View style={[styles.card, hasDuplicate && styles.cardWithWarning]}>
      {/* Main Row */}
      <Pressable style={styles.mainRow} onPress={handleToggleExpand}>
        <View style={styles.leftSection}>
          <View style={[
            styles.typeIndicator,
            transaction.type === 'income' ? styles.typeIncome : styles.typeExpense
          ]}>
            <Ionicons 
              name={transaction.type === 'income' ? 'arrow-down' : 'arrow-up'} 
              size={16} 
              color="#fff" 
            />
          </View>
          <View style={styles.mainInfo}>
            <Text style={styles.note} numberOfLines={1}>{transaction.note}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.category}>{transaction.matchedCategory}</Text>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.date}>{formattedDate}</Text>
            </View>
          </View>
        </View>
        <View style={styles.rightSection}>
          <Text style={[
            styles.amount,
            transaction.type === 'income' ? styles.amountIncome : styles.amountExpense
          ]}>
            {transaction.type === 'expense' ? '-' : '+'}{formattedAmount}
          </Text>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={theme.colors.textMuted} 
          />
        </View>
      </Pressable>

      {/* Duplicate Warning */}
      {hasDuplicate && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={16} color={WARNING_COLOR} />
          <Text style={styles.warningText}>
            Possible duplicate ({Math.round(duplicateMatch.confidence * 100)}% match)
          </Text>
        </View>
      )}

      {/* Expanded Edit Section */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          {/* Confidence Badge */}
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>AI Confidence:</Text>
            <View style={[
              styles.confidenceBadge,
              confidencePercent >= 80 ? styles.confidenceHigh :
              confidencePercent >= 50 ? styles.confidenceMedium : styles.confidenceLow
            ]}>
              <Text style={styles.confidenceText}>{confidencePercent}%</Text>
            </View>
          </View>

          {/* Amount Edit */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              style={styles.fieldInput}
              value={editAmount}
              onChangeText={setEditAmount}
              onBlur={handleAmountBlur}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Note Edit */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.fieldInput}
              value={editNote}
              onChangeText={setEditNote}
              onBlur={handleNoteBlur}
              placeholder="Transaction note"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Type Toggle */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Type</Text>
            <Pressable style={styles.typeToggle} onPress={handleTypeToggle}>
              <View style={[
                styles.typeOption,
                transaction.type === 'expense' && styles.typeOptionActive
              ]}>
                <Text style={[
                  styles.typeOptionText,
                  transaction.type === 'expense' && styles.typeOptionTextActive
                ]}>Expense</Text>
              </View>
              <View style={[
                styles.typeOption,
                transaction.type === 'income' && styles.typeOptionActive
              ]}>
                <Text style={[
                  styles.typeOptionText,
                  transaction.type === 'income' && styles.typeOptionTextActive
                ]}>Income</Text>
              </View>
            </Pressable>
          </View>

          {/* Category Picker */}
          <Pressable style={styles.fieldRow} onPress={() => setShowCategoryPicker(true)}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.pickerButton}>
              <Text style={styles.pickerButtonText}>{transaction.matchedCategory}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </View>
          </Pressable>

          {/* Date Picker */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Date</Text>
            <Pressable 
              style={styles.pickerButton} 
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Text style={styles.pickerButtonText}>{formattedDate}</Text>
              <Ionicons 
                name={showDatePicker ? "chevron-up" : "chevron-forward"} 
                size={18} 
                color={theme.colors.textMuted} 
              />
            </Pressable>
          </View>

          {/* Inline Date Picker */}
          {showDatePicker && (
            <View style={styles.inlineDatePicker}>
              <View style={styles.datePickerCenter}>
                <DateTimePicker
                  value={new Date(transaction.date)}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                />
              </View>
            </View>
          )}

          {/* Account Override */}
          <Pressable style={styles.fieldRow} onPress={() => setShowAccountPicker(true)}>
            <Text style={styles.fieldLabel}>Account</Text>
            <View style={styles.pickerButton}>
              <Text style={styles.pickerButtonText}>{accountName}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </View>
          </Pressable>

          {/* Delete Button */}
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            <Text style={styles.deleteButtonText}>Remove Transaction</Text>
          </Pressable>
        </View>
      )}

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <Pressable onPress={() => setShowCategoryPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            {relevantCategories.map((category) => (
              <Pressable
                key={category.id}
                style={[
                  styles.modalOption,
                  category.name === transaction.matchedCategory && styles.modalOptionActive
                ]}
                onPress={() => handleCategorySelect(category.name)}
              >
                <Text style={[
                  styles.modalOptionText,
                  category.name === transaction.matchedCategory && styles.modalOptionTextActive
                ]}>
                  {category.name}
                </Text>
                {category.name === transaction.matchedCategory && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Account Picker Modal */}
      <Modal
        visible={showAccountPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAccountPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Account</Text>
            <Pressable onPress={() => setShowAccountPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            {accounts.filter(a => !a.isArchived).map((account) => (
              <Pressable
                key={account.id}
                style={[
                  styles.modalOption,
                  account.id === ((transaction as unknown as { accountId?: string }).accountId || selectedAccountId) && styles.modalOptionActive
                ]}
                onPress={() => handleAccountSelect(account.id)}
              >
                <View>
                  <Text style={[
                    styles.modalOptionText,
                    account.id === ((transaction as unknown as { accountId?: string }).accountId || selectedAccountId) && styles.modalOptionTextActive
                  ]}>
                    {account.name}
                  </Text>
                  <Text style={styles.modalOptionSubtext}>{account.type}</Text>
                </View>
                {account.id === ((transaction as unknown as { accountId?: string }).accountId || selectedAccountId) && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    cardWithWarning: {
      borderColor: WARNING_COLOR,
      borderWidth: 2,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      flex: 1,
    },
    typeIndicator: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeExpense: {
      backgroundColor: theme.colors.danger,
    },
    typeIncome: {
      backgroundColor: theme.colors.success,
    },
    mainInfo: {
      flex: 1,
      gap: 4,
    },
    note: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    category: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    metaSeparator: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    date: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    amount: {
      fontSize: 16,
      fontWeight: '700',
    },
    amountExpense: {
      color: theme.colors.danger,
    },
    amountIncome: {
      color: theme.colors.success,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: `${WARNING_COLOR}15`,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: `${WARNING_COLOR}30`,
    },
    warningText: {
      fontSize: 13,
      color: WARNING_COLOR,
      fontWeight: '500',
    },
    expandedSection: {
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing.md,
      backgroundColor: `${theme.colors.primary}05`,
    },
    confidenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    confidenceLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    confidenceBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radii.pill,
    },
    confidenceHigh: {
      backgroundColor: `${theme.colors.success}20`,
    },
    confidenceMedium: {
      backgroundColor: `${WARNING_COLOR}20`,
    },
    confidenceLow: {
      backgroundColor: `${theme.colors.danger}20`,
    },
    confidenceText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    fieldLabel: {
      fontSize: 14,
      color: theme.colors.textMuted,
      minWidth: 80,
    },
    fieldInput: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 15,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    typeToggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderRadius: theme.radii.md,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    typeOption: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.sm,
    },
    typeOptionActive: {
      backgroundColor: theme.colors.primary,
    },
    typeOptionText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    typeOptionTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    pickerButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    pickerButtonText: {
      fontSize: 15,
      color: theme.colors.text,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      marginTop: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.danger}10`,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}30`,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.danger,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    modalContent: {
      flex: 1,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalOptionActive: {
      backgroundColor: `${theme.colors.primary}10`,
    },
    modalOptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    modalOptionTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    modalOptionSubtext: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    inlineDatePicker: {
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    datePickerCenter: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
