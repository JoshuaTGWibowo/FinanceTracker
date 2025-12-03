import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AccountType, selectActiveAccounts, useFinanceStore } from "../../lib/store";
import { useAppTheme } from "../../theme";

interface AccountPickerProps {
  label: string;
  value?: string | null;
  onChange: (accountId: string) => void;
  placeholder?: string;
  helperText?: string;
  excludeAccountIds?: string[];
  allowArchived?: boolean;
  currency: string;
}

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

const accountTypes: AccountType[] = ["cash", "bank", "card", "investment"];

export function AccountPicker({
  label,
  value,
  onChange,
  placeholder = "Choose an account",
  helperText,
  excludeAccountIds,
  allowArchived = false,
  currency,
}: AccountPickerProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const accounts = useFinanceStore(allowArchived ? (state) => state.accounts : selectActiveAccounts);
  const addAccount = useFinanceStore((state) => state.addAccount);

  // Form state for creating new account
  const [accountFormName, setAccountFormName] = useState("");
  const [accountFormType, setAccountFormType] = useState<AccountType>("bank");
  const [accountFormCurrency, setAccountFormCurrency] = useState(currency);
  const [accountFormInitialBalance, setAccountFormInitialBalance] = useState("");
  const [accountFormExcludeFromTotal, setAccountFormExcludeFromTotal] = useState(false);

  const filteredAccounts = useMemo(() => {
    if (!excludeAccountIds?.length) {
      return accounts;
    }

    return accounts.filter((account) => !excludeAccountIds.includes(account.id));
  }, [accounts, excludeAccountIds]);

  const selectedAccount = accounts.find((account) => account.id === value);

  const handleSelect = (accountId: string) => {
    onChange(accountId);
    setModalVisible(false);
  };

  const openCreateModal = () => {
    setModalVisible(false);
    setAccountFormName("");
    setAccountFormType("bank");
    setAccountFormCurrency(currency);
    setAccountFormInitialBalance("");
    setAccountFormExcludeFromTotal(false);
    setCreateModalVisible(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
    setAccountFormName("");
    setAccountFormType("bank");
    setAccountFormCurrency(currency);
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

    const newAccountId = await addAccount({
      name: accountFormName,
      type: accountFormType,
      currency: normalizedCurrency,
      initialBalance: initialBalanceValue,
      excludeFromTotal: accountFormExcludeFromTotal,
    });

    handleCloseCreateModal();
    
    // Auto-select the newly created account
    if (newAccountId) {
      onChange(newAccountId);
    }
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Pressable
        style={[styles.trigger, theme.components.inputSurface]}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={[
            styles.triggerText,
            { color: theme.colors.text },
            !selectedAccount && { color: theme.colors.textMuted },
          ]}
        >
          {selectedAccount ? selectedAccount.name : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>
      {selectedAccount ? (
        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
          {`${ACCOUNT_TYPE_LABELS[selectedAccount.type]} • ${formatCurrency(
            selectedAccount.balance,
            selectedAccount.currency || currency,
          )}`}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>{helperText}</Text>
      ) : null}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{label}</Text>
            <Pressable onPress={() => setModalVisible(false)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {filteredAccounts.length === 0 ? (
              <>
                <View style={styles.emptyState}>
                  <Ionicons name="wallet" size={32} color={theme.colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No accounts yet</Text>
                  <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                    Create a new account to start logging transactions.
                  </Text>
                </View>
                
                <Pressable
                  style={[styles.addAccountButton, theme.components.surface]}
                  onPress={openCreateModal}
                >
                  <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                  <Text style={[styles.addAccountText, { color: theme.colors.primary }]}>
                    Add New Account
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {filteredAccounts.map((account) => {
                  const active = account.id === value;
                  return (
                    <Pressable
                      key={account.id}
                      style={[styles.accountRow, active && { borderColor: theme.colors.primary }]}
                      onPress={() => handleSelect(account.id)}
                    >
                      <View style={styles.accountInfo}>
                        <Text style={[styles.accountName, { color: theme.colors.text }]}>{account.name}</Text>
                        <Text style={[styles.accountMeta, { color: theme.colors.textMuted }]}>
                          {`${ACCOUNT_TYPE_LABELS[account.type]} • ${formatCurrency(
                            account.balance,
                            account.currency || currency,
                          )}`}
                        </Text>
                      </View>
                      {active && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                    </Pressable>
                  );
                })}
                
                <Pressable
                  style={[styles.addAccountButton, theme.components.surface]}
                  onPress={openCreateModal}
                >
                  <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                  <Text style={[styles.addAccountText, { color: theme.colors.primary }]}>
                    Add New Account
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>

          <Pressable
            style={[styles.manageButton, theme.components.surface]}
            onPress={() => {
              setModalVisible(false);
              router.push("/(tabs)/account");
            }}
          >
            <Ionicons name="settings" size={16} color={theme.colors.text} />
            <Text style={[styles.manageButtonText, { color: theme.colors.text }]}>Manage accounts</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      {/* Create Account Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseCreateModal}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={24}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Account</Text>
              <Pressable style={styles.modalClose} onPress={handleCloseCreateModal}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.createModalBody}
              contentContainerStyle={styles.createModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Account Name</Text>
                <TextInput
                  value={accountFormName}
                  onChangeText={setAccountFormName}
                  placeholder="e.g., Main Checking"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.textInput, theme.components.inputSurface, { color: theme.colors.text }]}
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Type</Text>
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
                        style={[
                          styles.accountTypeCard,
                          theme.components.surface,
                          active && { borderColor: theme.colors.primary, borderWidth: 2 }
                        ]}
                        onPress={() => setAccountFormType(type)}
                      >
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={active ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.accountTypeCardText,
                            { color: theme.colors.text },
                            active && { color: theme.colors.primary, fontWeight: "600" }
                          ]}
                        >
                          {ACCOUNT_TYPE_LABELS[type]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, styles.flexField]}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Currency</Text>
                  <TextInput
                    value={accountFormCurrency}
                    onChangeText={(text) => setAccountFormCurrency(text.toUpperCase())}
                    placeholder="USD"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={3}
                    style={[styles.textInput, theme.components.inputSurface, { color: theme.colors.text }]}
                  />
                </View>

                <View style={[styles.fieldGroup, styles.flexField]}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Initial Balance</Text>
                  <TextInput
                    value={accountFormInitialBalance}
                    onChangeText={setAccountFormInitialBalance}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.textInput, theme.components.inputSurface, { color: theme.colors.text }]}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, styles.switchField]}>
                <View style={styles.switchLabelContainer}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Exclude from Total</Text>
                <Text style={[styles.fieldHelperText, { color: theme.colors.textMuted }]}>
                  Don&apos;t include this account in your net worth
                </Text>
                </View>
                <Switch
                  value={accountFormExcludeFromTotal}
                  onValueChange={setAccountFormExcludeFromTotal}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.background}
                />
              </View>
            </ScrollView>

            <View style={styles.createModalFooter}>
              <Pressable
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveAccount}
              >
                <Text style={styles.saveButtonText}>Create Account</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  trigger: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    fontSize: 16,
    flex: 1,
  },
  helperText: {
    fontSize: 13,
    marginTop: 6,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalClose: {
    padding: 8,
  },
  modalContent: {
    padding: 24,
    gap: 12,
  },
  accountRow: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "600",
  },
  accountMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  manageButton: {
    margin: 24,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  addAccountButton: {
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  addAccountText: {
    fontSize: 16,
    fontWeight: "600",
  },
  flex: {
    flex: 1,
  },
  createModalBody: {
    flex: 1,
  },
  createModalContent: {
    padding: 24,
    gap: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
  },
  accountTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  accountTypeCard: {
    flex: 1,
    minWidth: "45%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  accountTypeCardText: {
    fontSize: 14,
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  switchField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  switchLabelContainer: {
    flex: 1,
  },
  fieldHelperText: {
    fontSize: 12,
    marginTop: 4,
  },
  createModalFooter: {
    padding: 24,
    paddingTop: 12,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
