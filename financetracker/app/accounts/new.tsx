import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { AccountType, useFinanceStore } from "../../lib/store";
import { SUPPORTED_CURRENCIES } from "../../lib/currency";

type LocaleSeparators = {
  decimal: string;
  group: string;
};

const getLocaleSeparators = (): LocaleSeparators => {
  const formatter = new Intl.NumberFormat(undefined);

  if (typeof formatter.formatToParts !== "function") {
    return { decimal: ".", group: "," };
  }

  try {
    const parts = formatter.formatToParts(12345.6);
    const group = parts.find((part) => part.type === "group")?.value ?? ",";
    const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
    return { decimal, group };
  } catch {
    return { decimal: ".", group: "," };
  }
};

const formatRawAmountInput = (
  rawValue: string,
  separators: LocaleSeparators,
  groupingFormatter: Intl.NumberFormat,
): string => {
  const trimmed = rawValue.replace(/[\s']/g, "");
  if (!trimmed) {
    return "";
  }

  const sanitized = trimmed.replace(/[^0-9.,]/g, "");
  if (!sanitized) {
    return "";
  }

  const endsWithSeparator = /[.,]$/.test(trimmed);
  const groupingRegex = new RegExp(`\\${separators.group}`, "g");
  const normalized = sanitized.replace(groupingRegex, "");
  const lastSeparatorIndex = Math.max(normalized.lastIndexOf("."), normalized.lastIndexOf(","));

  let integerPartRaw = normalized;
  let decimalPartRaw = "";
  let hasDecimalSeparator = false;

  if (lastSeparatorIndex !== -1) {
    hasDecimalSeparator = true;
    integerPartRaw = normalized.slice(0, lastSeparatorIndex);
    decimalPartRaw = normalized.slice(lastSeparatorIndex + 1).replace(/[^0-9]/g, "");
  }

  const integerDigits = integerPartRaw.replace(/[^0-9]/g, "");

  if (!integerDigits) {
    if (decimalPartRaw) {
      return `0${separators.decimal}${decimalPartRaw}`;
    }
    return endsWithSeparator ? `0${separators.decimal}` : "";
  }

  const groupedInteger = groupingFormatter.format(Number(integerDigits));

  if (decimalPartRaw) {
    return `${groupedInteger}${separators.decimal}${decimalPartRaw}`;
  }

  if (endsWithSeparator) {
    return `${groupedInteger}${separators.decimal}`;
  }

  if (!hasDecimalSeparator && sanitized.endsWith(separators.group)) {
    return `${groupedInteger}${separators.decimal}`;
  }

  return groupedInteger;
};

const accountTypes: AccountType[] = ["cash", "bank", "card", "investment"];
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  investment: "Investment",
};

export default function NewAccountScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const profile = useFinanceStore((state) => state.profile);
  const addAccount = useFinanceStore((state) => state.addAccount);
  const setSelectedAccountId = useFinanceStore((state) => state.setSelectedAccountId);

  const [accountFormName, setAccountFormName] = useState("");
  const [accountFormType, setAccountFormType] = useState<AccountType>("bank");
  const [accountFormCurrency, setAccountFormCurrency] = useState(profile.currency.toUpperCase());
  const [accountFormInitialBalance, setAccountFormInitialBalance] = useState("");
  const [accountFormExcludeFromTotal, setAccountFormExcludeFromTotal] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  const separators = useMemo(() => getLocaleSeparators(), []);
  const groupingFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    [],
  );

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

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

    if (newAccountId) {
      setSelectedAccountId(newAccountId);
    }

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>New Account</Text>
            <Text style={styles.subtitle}>Create a wallet to track balances</Text>
          </View>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Account Name */}
          <View style={styles.modernFieldGroup}>
            <View style={styles.modernFieldIcon}>
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.modernFieldContent}>
              <Text style={styles.modernLabel}>Account Name</Text>
              <TextInput
                value={accountFormName}
                onChangeText={setAccountFormName}
                placeholder="e.g., Main Checking"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.modernInput}
              />
            </View>
          </View>

          {/* Account Type */}
          <View style={styles.modernFieldGroup}>
            <View style={styles.modernFieldIcon}>
              <Ionicons name="apps-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={[styles.modernFieldContent, { gap: theme.spacing.sm }]}>
              <Text style={styles.modernLabel}>Account Type</Text>
              <View style={styles.modernTypeGrid}>
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
                      style={[styles.modernTypeCard, active && styles.modernTypeCardActive]}
                      onPress={() => setAccountFormType(type)}
                    >
                      <View style={[styles.modernTypeIcon, active && styles.modernTypeIconActive]}>
                        <Ionicons
                          name={iconName}
                          size={22}
                          color={active ? "#fff" : theme.colors.textMuted}
                        />
                      </View>
                      <Text style={[styles.modernTypeText, active && styles.modernTypeTextActive]}>
                        {ACCOUNT_TYPE_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Currency & Balance */}
          <View style={styles.modernRow}>
            <Pressable 
              style={[styles.modernFieldGroup, { flex: 1 }]}
              onPress={() => setCurrencyPickerVisible(true)}
            >
              <View style={styles.modernFieldIcon}>
                <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.modernFieldContent}>
                <Text style={styles.modernLabel}>Currency</Text>
                <View style={styles.currencyPickerValue}>
                  <Text style={styles.modernInput}>{accountFormCurrency}</Text>
                  <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
                </View>
              </View>
            </Pressable>

            <View style={[styles.modernFieldGroup, { flex: 1.2 }]}>
              <View style={styles.modernFieldIcon}>
                <Ionicons name="calculator-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.modernFieldContent}>
                <Text style={styles.modernLabel}>Initial Balance</Text>
                <TextInput
                  value={accountFormInitialBalance}
                  onChangeText={(value) => setAccountFormInitialBalance(formatRawAmountInput(value, separators, groupingFormatter))}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.modernInput}
                />
              </View>
            </View>
          </View>

          {/* Exclude Toggle */}
          <Pressable 
            style={[styles.modernToggleCard, accountFormExcludeFromTotal && styles.modernToggleCardActive]}
            onPress={() => setAccountFormExcludeFromTotal(!accountFormExcludeFromTotal)}
          >
            <View style={styles.modernToggleIcon}>
              <Ionicons 
                name={accountFormExcludeFromTotal ? "eye-off" : "eye-off-outline"} 
                size={20} 
                color={accountFormExcludeFromTotal ? theme.colors.primary : theme.colors.textMuted} 
              />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.modernLabel, accountFormExcludeFromTotal && { color: theme.colors.text }]}>
                Exclude from Totals
              </Text>
              <Text style={styles.modernHelper}>
                {accountFormExcludeFromTotal ? "Hidden from total balance" : "Included in total balance"}
              </Text>
            </View>
            <View style={[
              styles.modernToggleSwitch,
              accountFormExcludeFromTotal && styles.modernToggleSwitchActive
            ]}>
              <View style={[
                styles.modernToggleThumb,
                accountFormExcludeFromTotal && styles.modernToggleThumbActive
              ]} />
            </View>
          </Pressable>

          {/* Action Buttons */}
          <View style={styles.modernActions}>
            <Pressable 
              style={[styles.modernButton, styles.modernButtonSecondary]} 
              onPress={() => router.back()}
            >
              <Text style={styles.modernButtonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable 
              style={[styles.modernButton, styles.modernButtonPrimary]} 
              onPress={handleSaveAccount}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.modernButtonPrimaryText}>Create Account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Currency Picker Modal */}
      <Modal
        visible={currencyPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCurrencyPickerVisible(false)}
      >
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <Pressable style={styles.modalClose} onPress={() => setCurrencyPickerVisible(false)}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>

          <FlatList
            data={SUPPORTED_CURRENCIES}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.currencyListContent}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.currencyListItem,
                  item.code === accountFormCurrency && styles.currencyListItemActive,
                ]}
                onPress={() => {
                  setAccountFormCurrency(item.code);
                  setCurrencyPickerVisible(false);
                }}
              >
                <View style={styles.currencyListItemLeft}>
                  <Text style={styles.currencyListCode}>{item.code}</Text>
                  <Text style={styles.currencyListName}>{item.name}</Text>
                </View>
                <Text style={styles.currencyListSymbol}>{item.symbol}</Text>
                {item.code === accountFormCurrency && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                )}
              </Pressable>
            )}
          />
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: theme.spacing.sm,
      marginLeft: -theme.spacing.sm,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...theme.typography.title,
      fontSize: 20,
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    body: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl + insets.bottom,
      gap: theme.spacing.md,
    },
    modernFieldGroup: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modernFieldIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
    },
    modernFieldContent: {
      flex: 1,
      gap: 4,
    },
    modernLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    modernInput: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
      paddingVertical: 4,
    },
    modernTypeGrid: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    modernTypeCard: {
      flex: 1,
      alignItems: "center",
      gap: 6,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: 4,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    modernTypeCardActive: {
      backgroundColor: `${theme.colors.primary}08`,
      borderColor: theme.colors.primary,
    },
    modernTypeIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    modernTypeIconActive: {
      backgroundColor: theme.colors.primary,
    },
    modernTypeText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    modernTypeTextActive: {
      color: theme.colors.text,
    },
    modernRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    currencyPickerValue: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    modernToggleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modernToggleCardActive: {
      backgroundColor: `${theme.colors.primary}08`,
      borderColor: `${theme.colors.primary}40`,
    },
    modernToggleIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}12`,
      alignItems: "center",
      justifyContent: "center",
    },
    modernHelper: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    modernToggleSwitch: {
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.border,
      padding: 2,
      justifyContent: "center",
    },
    modernToggleSwitchActive: {
      backgroundColor: theme.colors.primary,
    },
    modernToggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#fff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    modernToggleThumbActive: {
      transform: [{ translateX: 18 }],
    },
    modernActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.lg,
    },
    modernButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.md + 2,
      borderRadius: theme.radii.lg,
    },
    modernButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modernButtonPrimary: {
      backgroundColor: theme.colors.primary,
      flex: 1.5,
    },
    modernButtonSecondaryText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modernButtonPrimaryText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
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
    currencyListContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    currencyListItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      marginBottom: 2,
    },
    currencyListItemActive: {
      backgroundColor: `${theme.colors.primary}12`,
    },
    currencyListItemLeft: {
      flex: 1,
      gap: 2,
    },
    currencyListCode: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    currencyListName: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    currencyListSymbol: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMuted,
      minWidth: 32,
      textAlign: "center",
    },
  });
