import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { Account, AccountType, useFinanceStore } from "../../lib/store";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
const accountTypes: AccountType[] = ["cash", "bank", "card", "investment"];
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  investment: "Investment",
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);

export default function AccountsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const profile = useFinanceStore((state) => state.profile);
  const accounts = useFinanceStore((state) => state.accounts);
  const addAccount = useFinanceStore((state) => state.addAccount);
  const updateAccountAction = useFinanceStore((state) => state.updateAccount);
  const archiveAccount = useFinanceStore((state) => state.archiveAccount);

  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormName, setAccountFormName] = useState("");
  const [accountFormType, setAccountFormType] = useState<AccountType>("bank");
  const [accountFormCurrency, setAccountFormCurrency] = useState(profile.currency);
  const [accountFormInitialBalance, setAccountFormInitialBalance] = useState("");
  const [accountFormExcludeFromTotal, setAccountFormExcludeFromTotal] = useState(false);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const openAccountModal = (account?: Account) => {
    if (account) {
      setEditingAccountId(account.id);
      setAccountFormName(account.name);
      setAccountFormType(account.type);
      setAccountFormCurrency((account.currency || profile.currency).toUpperCase());
      setAccountFormInitialBalance(account.initialBalance.toString());
      setAccountFormExcludeFromTotal(Boolean(account.excludeFromTotal));
    } else {
      setEditingAccountId(null);
      setAccountFormName("");
      setAccountFormType("bank");
      setAccountFormCurrency(profile.currency.toUpperCase());
      setAccountFormInitialBalance("");
      setAccountFormExcludeFromTotal(false);
    }
    setAccountModalVisible(true);
  };

  const handleCloseAccountModal = () => {
    setAccountModalVisible(false);
    setEditingAccountId(null);
    setAccountFormName("");
    setAccountFormType("bank");
    setAccountFormCurrency(profile.currency.toUpperCase());
    setAccountFormInitialBalance("");
    setAccountFormExcludeFromTotal(false);
  };

  const handleSaveAccount = async () => {
    if (!accountFormName.trim()) {
      Alert.alert("Heads up", "Give the account a name first.");
      return;
    }

    if (!accountFormCurrency.trim()) {
      Alert.alert("Heads up", "Currency code cannot be empty.");
      return;
    }

    const sanitizedBalance = accountFormInitialBalance.replace(/[^0-9.-]/g, "");
    const parsedInitial = sanitizedBalance ? Number(sanitizedBalance) : 0;
    const initialBalanceValue = Number.isNaN(parsedInitial) ? 0 : parsedInitial;
    const normalizedCurrency = accountFormCurrency.trim().toUpperCase();

    if (editingAccountId) {
      await updateAccountAction(editingAccountId, {
        name: accountFormName,
        type: accountFormType,
        currency: normalizedCurrency,
        initialBalance: initialBalanceValue,
        excludeFromTotal: accountFormExcludeFromTotal,
      });
    } else {
      await addAccount({
        name: accountFormName,
        type: accountFormType,
        currency: normalizedCurrency,
        initialBalance: initialBalanceValue,
        excludeFromTotal: accountFormExcludeFromTotal,
      });
    }

    handleCloseAccountModal();
  };

  const handleToggleArchive = async (account: Account) => {
    await archiveAccount(account.id, !account.isArchived);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>Accounts</Text>
              <Text style={styles.subtitle}>Organize wallets and track balances.</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Your accounts</Text>
                <Text style={styles.sectionSubtitle}>Manage balances and visibility.</Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => openAccountModal()}>
                <Ionicons name="add" size={16} color={theme.colors.text} />
                <Text style={styles.secondaryButtonText}>Add</Text>
              </Pressable>
            </View>

            {accounts.length === 0 ? (
              <Text style={[styles.helperText, styles.emptyStateText]}>
                Add your first account to start tracking balances.
              </Text>
            ) : (
              <View style={styles.accountsList}>
                {accounts.map((account) => (
                  <View
                    key={account.id}
                    style={[styles.accountRow, account.isArchived && styles.archivedAccount]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountMeta}>
                        {ACCOUNT_TYPE_LABELS[account.type]} • {formatCurrency(
                          account.balance,
                          account.currency || profile.currency,
                        )}
                        {account.isArchived ? " • Archived" : ""}
                        {account.excludeFromTotal ? " • Excluded" : ""}
                      </Text>
                    </View>
                    <View style={styles.accountActions}>
                      <Pressable
                        onPress={() => openAccountModal(account)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                      >
                        <Ionicons name="create-outline" size={18} color={theme.colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleToggleArchive(account)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={account.isArchived ? "refresh" : "archive-outline"}
                          size={18}
                          color={account.isArchived ? theme.colors.success : theme.colors.text}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={accountModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseAccountModal}
      >
        <SafeAreaView style={[styles.accountModal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingAccountId ? "Edit account" : "Add account"}
            </Text>
            <Pressable style={styles.modalClose} onPress={handleCloseAccountModal}>
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.accountModalBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Account name</Text>
              <TextInput
                value={accountFormName}
                onChangeText={setAccountFormName}
                placeholder="Vacation savings"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.accountTypeRow}>
                {accountTypes.map((type) => {
                  const active = accountFormType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.accountTypeChip, active && styles.accountTypeChipActive]}
                      onPress={() => setAccountFormType(type)}
                    >
                      <Text
                        style={[styles.accountTypeChipText, active && styles.accountTypeChipTextActive]}
                      >
                        {ACCOUNT_TYPE_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Currency</Text>
              <View style={styles.row}>
                <TextInput
                  value={accountFormCurrency}
                  onChangeText={(value) => setAccountFormCurrency(value.toUpperCase())}
                  placeholder="USD"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                  style={[styles.input, styles.currencyInput, styles.flex]}
                />
                <ScrollView
                  style={styles.flex}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {currencies.map((code) => {
                    const active = accountFormCurrency === code;
                    return (
                      <Pressable
                        key={code}
                        onPress={() => setAccountFormCurrency(code)}
                        style={[styles.currencyChip, active && styles.currencyChipActive]}
                      >
                        <Text
                          style={[
                            styles.currencyChipText,
                            active && styles.currencyChipTextActive,
                          ]}
                        >
                          {code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Initial balance</Text>
              <TextInput
                value={accountFormInitialBalance}
                onChangeText={setAccountFormInitialBalance}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.helperText}>Set the starting balance for this account.</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Exclude from totals</Text>
                <Text style={styles.helperText}>
                  Hide this wallet from total balance and overview cards.
                </Text>
              </View>
              <Switch
                value={accountFormExcludeFromTotal}
                onValueChange={setAccountFormExcludeFromTotal}
                thumbColor={accountFormExcludeFromTotal ? theme.colors.primary : theme.colors.surface}
                trackColor={{ true: `${theme.colors.primary}55`, false: theme.colors.border }}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={handleCloseAccountModal}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleSaveAccount}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.xl,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    headerSpacer: {
      width: 40,
    },
    title: {
      ...theme.typography.title,
      fontSize: 24,
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    sectionCard: {
      gap: theme.spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    sectionTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    helperText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    fieldGroup: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    input: {
      ...theme.components.input,
      fontSize: 16,
    },
    currencyInput: {
      letterSpacing: 3,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    currencyChip: {
      ...theme.components.chip,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    currencyChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    currencyChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    currencyChipTextActive: {
      color: theme.colors.text,
    },
    accountsList: {
      gap: theme.spacing.md,
    },
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    archivedAccount: {
      opacity: 0.6,
    },
    accountName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    accountMeta: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    accountActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginLeft: theme.spacing.md,
    },
    iconButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    emptyStateText: {
      ...theme.typography.subtitle,
      fontSize: 13,
      marginTop: theme.spacing.sm,
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.xl,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    secondaryButton: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      ...theme.typography.title,
      fontSize: 22,
    },
    modalClose: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    accountModal: {
      flex: 1,
    },
    accountModalBody: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    accountTypeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    accountTypeChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    accountTypeChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    accountTypeChipText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    accountTypeChipTextActive: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.spacing.md,
    },
  });
