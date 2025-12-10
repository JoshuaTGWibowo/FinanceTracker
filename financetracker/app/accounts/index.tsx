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

  const activeAccounts = accounts.filter((acc) => !acc.isArchived);
  const archivedAccounts = accounts.filter((acc) => acc.isArchived);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundAccent} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <View style={styles.headerContainer}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Accounts</Text>
            <Text style={styles.subtitle}>Manage wallets and balances</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={[theme.components.surface, styles.formCard]}>
            <View style={styles.formHeader}>
              <View style={styles.formIconContainer}>
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.formTitle}>Add New Account</Text>
                <Text style={styles.formSubtitle}>Create a wallet to track balances</Text>
              </View>
            </View>

            <Pressable style={styles.primaryButton} onPress={() => openAccountModal()}>
              <Ionicons name="add" size={18} color={theme.colors.text} />
              <Text style={styles.primaryButtonText}>Create account</Text>
            </Pressable>
          </View>

          <View style={[theme.components.surface, styles.accountsCard]}>
            <View style={styles.accountsHeader}>
              <View style={styles.flex}>
                <Text style={styles.accountsTitle}>Active Accounts</Text>
                <Text style={styles.accountsSubtitle}>
                  {activeAccounts.length} {activeAccounts.length === 1 ? "account" : "accounts"} active
                </Text>
              </View>
              <View style={styles.accountsBadge}>
                <Ionicons name="wallet" size={16} color={theme.colors.primary} />
              </View>
            </View>

            {activeAccounts.length > 0 ? (
              <View style={styles.accountsList}>
                {activeAccounts.map((account) => (
                  <View key={account.id} style={styles.accountCard}>
                    <View style={styles.accountCardHeader}>
                      <View style={styles.accountCardIcon}>
                        <Ionicons
                          name={
                            account.type === "cash"
                              ? "cash"
                              : account.type === "bank"
                              ? "business"
                              : account.type === "card"
                              ? "card"
                              : "trending-up"
                          }
                          size={18}
                          color={theme.colors.text}
                        />
                      </View>
                      <View style={styles.accountCardInfo}>
                        <Text style={styles.accountCardName}>{account.name}</Text>
                        <View style={styles.accountCardMeta}>
                          <View style={styles.accountMetaBadge}>
                            <Ionicons name="pricetag" size={11} color={theme.colors.textMuted} />
                            <Text style={styles.accountMetaText}>{ACCOUNT_TYPE_LABELS[account.type]}</Text>
                          </View>
                          {account.excludeFromTotal && (
                            <>
                              <Text style={styles.accountMetaDivider}>•</Text>
                              <View style={styles.accountMetaBadge}>
                                <Ionicons name="eye-off" size={11} color={theme.colors.textMuted} />
                                <Text style={styles.accountMetaText}>Excluded</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                      <View style={styles.accountCardActions}>
                        <Pressable
                          onPress={() => openAccountModal(account)}
                          style={styles.accountActionButton}
                        >
                          <Ionicons name="create-outline" size={16} color={theme.colors.text} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleToggleArchive(account)}
                          style={styles.accountActionButton}
                        >
                          <Ionicons name="archive-outline" size={16} color={theme.colors.text} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.accountCardBalance}>
                      <Text style={styles.accountBalanceLabel}>Balance</Text>
                      <Text style={styles.accountBalanceAmount}>
                        {formatCurrency(account.balance, account.currency || profile.currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={48} color={theme.colors.textMuted} />
                <Text style={styles.emptyStateText}>No active accounts yet</Text>
                <Text style={styles.emptyStateSubtext}>Create your first account to get started</Text>
              </View>
            )}
          </View>

          {archivedAccounts.length > 0 && (
            <View style={[theme.components.surface, styles.accountsCard]}>
              <View style={styles.accountsHeader}>
                <View>
                  <Text style={styles.accountsTitle}>Archived Accounts</Text>
                  <Text style={styles.accountsSubtitle}>
                    {archivedAccounts.length} {archivedAccounts.length === 1 ? "account" : "accounts"} archived
                  </Text>
                </View>
                <View style={styles.accountsBadge}>
                  <Ionicons name="archive" size={18} color={theme.colors.textMuted} />
                </View>
              </View>

              <View style={styles.accountsList}>
                {archivedAccounts.map((account) => (
                  <View key={account.id} style={[styles.accountCard, styles.archivedCard]}>
                    <View style={styles.accountCardHeader}>
                      <View style={[styles.accountCardIcon, styles.archivedIcon]}>
                        <Ionicons
                          name={
                            account.type === "cash"
                              ? "cash"
                              : account.type === "bank"
                              ? "business"
                              : account.type === "card"
                              ? "card"
                              : "trending-up"
                          }
                          size={20}
                          color={theme.colors.textMuted}
                        />
                      </View>
                      <View style={styles.accountCardInfo}>
                        <Text style={[styles.accountCardName, styles.archivedText]}>{account.name}</Text>
                        <View style={styles.accountCardMeta}>
                          <View style={styles.accountMetaBadge}>
                            <Ionicons name="pricetag" size={12} color={theme.colors.textMuted} />
                            <Text style={styles.accountMetaText}>{ACCOUNT_TYPE_LABELS[account.type]}</Text>
                          </View>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleToggleArchive(account)}
                        style={styles.accountActionButton}
                      >
                        <Ionicons name="refresh" size={18} color={theme.colors.success} />
                      </Pressable>
                    </View>
                    <View style={styles.accountCardBalance}>
                      <Text style={styles.accountBalanceLabel}>Balance</Text>
                      <Text style={[styles.accountBalanceAmount, styles.archivedText]}>
                        {formatCurrency(account.balance, account.currency || profile.currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
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
              {editingAccountId ? "Edit Account" : "New Account"}
            </Text>
            <Pressable style={styles.modalClose} onPress={handleCloseAccountModal}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.accountModalBody}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput
                value={accountFormName}
                onChangeText={setAccountFormName}
                placeholder="e.g., Main Checking"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                autoFocus={!editingAccountId}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.accountTypeGrid}>
                {accountTypes.map((type) => {
                  const active = accountFormType === type;
                  const iconName =
                    type === "cash"
                      ? "cash"
                      : type === "bank"
                      ? "business"
                      : type === "card"
                      ? "card"
                      : "trending-up";
                  return (
                    <Pressable
                      key={type}
                      style={[styles.accountTypeCard, active && styles.accountTypeCardActive]}
                      onPress={() => setAccountFormType(type)}
                    >
                      <Ionicons
                        name={iconName}
                        size={20}
                        color={active ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <Text
                        style={[styles.accountTypeCardText, active && styles.accountTypeCardTextActive]}
                      >
                        {ACCOUNT_TYPE_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.label}>Currency</Text>
                <TextInput
                  value={accountFormCurrency}
                  onChangeText={(value) => setAccountFormCurrency(value.toUpperCase())}
                  placeholder="USD"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={3}
                  style={styles.input}
                />
              </View>

              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.label}>Initial Balance</Text>
                <TextInput
                  value={accountFormInitialBalance}
                  onChangeText={setAccountFormInitialBalance}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Exclude from Totals</Text>
                <Text style={styles.helperText}>Hide from total balance</Text>
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
                <Text style={styles.primaryButtonText}>{editingAccountId ? "Update" : "Save"}</Text>
              </Pressable>
            </View>
          </ScrollView>
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
      position: "relative",
    },
    backgroundAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 160,
      backgroundColor: `${theme.colors.primary}15`,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    flex: {
      flex: 1,
    },
    headerContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    backButton: {
      padding: theme.spacing.xs,
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...theme.typography.title,
      fontSize: 24,
      fontWeight: "700",
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      marginTop: 2,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.lg + insets.bottom,
      gap: theme.spacing.md,
    },
    formCard: {
      gap: theme.spacing.md,
    },
    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    formIconContainer: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    formTitle: {
      ...theme.typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
    },
    formSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
      fontSize: 15,
    },
    accountsCard: {},
    accountsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    accountsTitle: {
      ...theme.typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
    },
    accountsSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    accountsBadge: {
      width: 34,
      height: 34,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    accountsList: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    accountCard: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    archivedCard: {
      opacity: 0.6,
    },
    accountCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    accountCardIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    archivedIcon: {
      backgroundColor: `${theme.colors.textMuted}22`,
    },
    accountCardInfo: {
      flex: 1,
      gap: 2,
    },
    accountCardName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    archivedText: {
      opacity: 0.7,
    },
    accountCardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    accountMetaBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    accountMetaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    accountMetaDivider: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    accountCardActions: {
      flexDirection: "row",
      gap: 6,
    },
    accountActionButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    accountCardBalance: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    accountBalanceLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    accountBalanceAmount: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyStateText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    emptyStateSubtext: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      ...theme.typography.label,
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      ...theme.components.input,
      fontSize: 15,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    currencyInput: {
      letterSpacing: 2,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    currencyChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    currencyChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    currencyChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    currencyChipTextActive: {
      color: theme.colors.text,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 3,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      ...theme.typography.title,
      fontSize: 20,
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
      flex: 1,
    },
    modalScrollContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    accountTypeGrid: {
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    accountTypeCard: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    accountTypeCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}12`,
    },
    accountTypeCardText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    accountTypeCardTextActive: {
      color: theme.colors.text,
    },
    accountTypeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    accountTypeChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
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
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    accountTypeChipTextActive: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    secondaryButton: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 15,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.md,
    },
  });
