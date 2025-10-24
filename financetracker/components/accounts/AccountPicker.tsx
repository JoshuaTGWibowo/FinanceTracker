import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import { Account, selectAccounts, useFinanceStore } from "../../lib/store";

interface AccountPickerProps {
  selectedAccountId?: string | null;
  onSelect: (accountId: string) => void;
  placeholder?: string;
  includeArchived?: boolean;
  disabledAccountIds?: string[];
  extraOptions?: { id: string; label: string; description?: string }[];
  currency: string;
}

const ACCOUNT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  default: "wallet",
  archived: "archive",
};

export function AccountPicker({
  selectedAccountId,
  onSelect,
  placeholder = "Select account",
  includeArchived = false,
  disabledAccountIds = [],
  extraOptions = [],
  currency,
}: AccountPickerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const accounts = useFinanceStore(selectAccounts);

  const [visible, setVisible] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const selectedExtraOption = useMemo(
    () => extraOptions.find((option) => option.id === selectedAccountId) ?? null,
    [extraOptions, selectedAccountId],
  );

  const visibleAccounts = useMemo(() => {
    if (includeArchived) {
      return accounts;
    }

    return accounts.filter(
      (account) => !account.isArchived || account.id === selectedAccountId,
    );
  }, [accounts, includeArchived, selectedAccountId]);

  const sortedAccounts = useMemo(
    () =>
      [...visibleAccounts].sort((a, b) => {
        if (a.isArchived === b.isArchived) {
          return a.name.localeCompare(b.name);
        }
        return a.isArchived ? 1 : -1;
      }),
    [visibleAccounts],
  );

  const disabledSet = useMemo(() => new Set(disabledAccountIds), [disabledAccountIds]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setVisible(false);
  };

  const renderAccount = (account: Account) => {
    const isSelected = account.id === selectedAccountId;
    const isDisabled = disabledSet.has(account.id);

    return (
      <Pressable
        key={account.id}
        style={[styles.option, isSelected && styles.optionActive, isDisabled && styles.optionDisabled]}
        onPress={() => !isDisabled && handleSelect(account.id)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      >
        <View style={styles.optionLabelRow}>
          <Ionicons
            name={account.isArchived ? ACCOUNT_ICONS.archived : ACCOUNT_ICONS.default}
            size={18}
            color={theme.colors.text}
          />
          <View style={styles.optionTextGroup}>
            <Text style={styles.optionTitle}>{account.name}</Text>
            <Text style={styles.optionSubtitle}>{formatter.format(account.balance)}</Text>
          </View>
          {account.isArchived && <Text style={styles.archivedBadge}>Archived</Text>}
        </View>
        {isSelected && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
      </Pressable>
    );
  };

  const renderExtraOption = (option: { id: string; label: string; description?: string }) => {
    const isSelected = option.id === selectedAccountId;
    const isDisabled = disabledSet.has(option.id);

    return (
      <Pressable
        key={option.id}
        style={[styles.option, isSelected && styles.optionActive, isDisabled && styles.optionDisabled]}
        onPress={() => !isDisabled && handleSelect(option.id)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      >
        <View style={styles.optionTextGroup}>
          <Text style={styles.optionTitle}>{option.label}</Text>
          {option.description ? (
            <Text style={styles.optionSubtitle}>{option.description}</Text>
          ) : null}
        </View>
        {isSelected && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
      </Pressable>
    );
  };

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
      >
        <View style={styles.triggerTextContainer}>
          <Text
            style={selectedAccount || selectedExtraOption ? styles.triggerText : styles.triggerPlaceholder}
          >
            {selectedExtraOption
              ? selectedExtraOption.label
              : selectedAccount
                ? selectedAccount.name
                : placeholder}
          </Text>
          {selectedExtraOption?.description ? (
            <Text style={styles.triggerMeta}>{selectedExtraOption.description}</Text>
          ) : selectedAccount ? (
            <Text style={styles.triggerMeta}>{formatter.format(selectedAccount.balance)}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>

      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select account</Text>
            <Pressable
              style={styles.modalClose}
              onPress={() => setVisible(false)}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {extraOptions.map(renderExtraOption)}
            {sortedAccounts.map(renderAccount)}
            {sortedAccounts.length === 0 && extraOptions.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle" size={20} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>No accounts available yet.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    trigger: {
      ...theme.components.input,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    triggerTextContainer: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    triggerText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    triggerPlaceholder: {
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    triggerMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
    },
    modalTitle: {
      ...theme.typography.title,
      fontSize: 20,
    },
    modalClose: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    modalContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    option: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    optionActive: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    optionDisabled: {
      opacity: 0.4,
    },
    optionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    optionTextGroup: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    optionTitle: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    optionSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    archivedBadge: {
      fontSize: 12,
      color: theme.colors.textMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.radii.pill,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    emptyState: {
      paddingVertical: theme.spacing.xl,
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    emptyText: {
      color: theme.colors.textMuted,
      textAlign: "center",
    },
  });
