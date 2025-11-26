import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import { ThemeMode, useFinanceStore } from "../../lib/store";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

export default function AccountScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const profile = useFinanceStore((state) => state.profile);
  const updateProfile = useFinanceStore((state) => state.updateProfile);
  const themeMode = useFinanceStore((state) => state.preferences.themeMode);
  const setThemeMode = useFinanceStore((state) => state.setThemeMode);
  const accounts = useFinanceStore((state) => state.accounts);
  const transactions = useFinanceStore((state) => state.transactions);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const loadMockData = useFinanceStore((state) => state.loadMockData);
  const clearAllDataAndReload = useFinanceStore((state) => state.clearAllDataAndReload);

  const [name, setName] = useState(profile.name);
  const [currency, setCurrency] = useState(profile.currency);
  const [isLoadingMockData, setIsLoadingMockData] = useState(false);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  useEffect(() => {
    setName(profile.name);
    setCurrency(profile.currency);
  }, [profile.name, profile.currency]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Heads up", "Please add a display name.");
      return;
    }

    if (!currency.trim()) {
      Alert.alert("Heads up", "Currency cannot be empty.");
      return;
    }

    await updateProfile({ name: name.trim(), currency: currency.trim().toUpperCase() });
    Alert.alert("Saved", "Profile updated successfully.");
  };



  const handleLoadMockData = () => {
    Alert.alert(
      "Load Mock Data",
      "This will add sample accounts, transactions, recurring events, and budget goals for testing. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load",
          onPress: async () => {
            setIsLoadingMockData(true);
            try {
              await loadMockData();
              Alert.alert("Success", "Mock data has been loaded successfully.");
            } catch (error) {
              Alert.alert("Error", "Failed to load mock data.");
              console.error(error);
            } finally {
              setIsLoadingMockData(false);
            }
          },
        },
      ],
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      "Clear All Data",
      "This will delete ALL transactions, accounts, budget goals, and recurring events. This action cannot be undone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsLoadingMockData(true);
            try {
              await clearAllDataAndReload();
              Alert.alert("Success", "All data has been cleared.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear data.");
              console.error(error);
            } finally {
              setIsLoadingMockData(false);
            }
          },
        },
      ],
    );
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
          <View style={styles.header}>
            <Text style={styles.title}>Account & preferences</Text>
            <Text style={styles.subtitle}>Personalize how your finance world looks.</Text>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Profile name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your display name"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Currency</Text>
              <View style={styles.currencyRow}>
                <TextInput
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="USD"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                  style={[styles.input, styles.currencyInput]}
                />
                <View style={styles.chipsRow}>
                  {currencies.map((code) => {
                    const isActive = currency.toUpperCase() === code;
                    return (
                      <Pressable
                        key={code}
                        onPress={() => setCurrency(code)}
                        style={[styles.currencyChip, isActive && styles.currencyChipActive]}
                      >
                        <Text style={[styles.currencyChipText, isActive && styles.currencyChipTextActive]}>
                          {code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <Pressable style={styles.primaryButton} onPress={handleSaveProfile}>
              <Text style={styles.primaryButtonText}>Save profile</Text>
            </Pressable>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Theme</Text>
            <View style={styles.themeRow}>
              {(["dark", "light"] as ThemeMode[]).map((mode) => {
                const active = themeMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.themeChip, active && styles.themeChipActive]}
                    onPress={() => void setThemeMode(mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={mode === "dark" ? "moon" : "sunny"}
                      size={18}
                      color={active ? theme.colors.text : theme.colors.textMuted}
                    />
                    <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                      {mode === "dark" ? "Dark" : "Light"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <Pressable style={styles.linkRow} onPress={() => router.push("/categories")}>
              <View style={styles.linkRowContent}>
                <View style={styles.linkIcon}>
                  <Ionicons name="pricetags-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>Categories</Text>
                  <Text style={styles.linkSubtitle}>View and manage expense, income, and debt lists.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push("/accounts")}>
              <View style={styles.linkRowContent}>
                <View style={styles.linkIcon}>
                  <Ionicons name="wallet-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>Accounts</Text>
                  <Text style={styles.linkSubtitle}>View and manage all wallets and balances.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push("/budgets/" as any)}>
              <View style={styles.linkRowContent}>
                <View style={styles.linkIcon}>
                  <Ionicons name="stats-chart-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>Budgets</Text>
                  <Text style={styles.linkSubtitle}>Set spending limits for your categories.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Leaderboard & Social</Text>
            <Text style={styles.sectionSubtitle}>
              Your stats sync automatically. Pull down on the Crew tab to refresh.
            </Text>

            <Pressable
              style={styles.dangerButton}
              onPress={async () => {
                const { supabase } = require('../../lib/supabase');
                const { error } = await supabase.auth.signOut();
                
                if (error) {
                  Alert.alert('Error', 'Failed to sign out');
                } else {
                  Alert.alert('Success', 'Signed out successfully!');
                }
              }}
            >
              <Text style={styles.dangerButtonText}>Sign Out</Text>
            </Pressable>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Developer Tools</Text>
            <Text style={styles.sectionSubtitle}>
              Testing utilities for development and debugging.
            </Text>

            <View style={styles.fieldGroup}>
              <View style={styles.devToolRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Mock Data</Text>
                  <Text style={styles.helperText}>
                    {transactions.length > 0
                      ? `${transactions.length} transactions, ${accounts.length} accounts`
                      : "No data yet"}
                  </Text>
                </View>
                <View style={styles.devToolActions}>
                  <Pressable
                    style={[styles.secondaryButton, isLoadingMockData && styles.buttonDisabled]}
                    onPress={handleLoadMockData}
                    disabled={isLoadingMockData}
                  >
                    <Ionicons name="cloud-download-outline" size={16} color={theme.colors.text} />
                    <Text style={styles.secondaryButtonText}>
                      {isLoadingMockData ? "Loading..." : "Load"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dangerButton, isLoadingMockData && styles.buttonDisabled]}
                    onPress={handleClearAllData}
                    disabled={isLoadingMockData}
                  >
                    <Ionicons name="trash-outline" size={16} color={"#fff"} />
                    <Text style={styles.dangerButtonText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>


        </ScrollView>
      </KeyboardAvoidingView>
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
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.xl,
    },
    header: {
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.title,
      fontSize: 26,
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
    currencyRow: {
      gap: theme.spacing.md,
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
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    themeRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    themeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    themeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    themeChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "capitalize",
    },
    themeChipTextActive: {
      color: theme.colors.text,
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
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.md,
    },
    linkRowContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    linkIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    linkTitle: {
      ...theme.typography.subtitle,
      fontSize: 15,
    },
    linkSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    periodField: {
      maxWidth: 150,
    },
    goalList: {
      gap: theme.spacing.md,
    },
    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    goalCopy: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    goalName: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    goalMeta: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    deleteButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    devToolRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    devToolActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    dangerButton: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.danger,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      justifyContent: "center",
    },
    dangerButtonText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });

