import { useEffect, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { DEFAULT_CATEGORIES } from "../../lib/types";
import { useFinanceStore } from "../../lib/store";

const iconToName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export default function EditCategoryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const categories = useFinanceStore((state) => state.preferences.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const updateCategory = useFinanceStore((state) => state.updateCategory);
  const draft = useFinanceStore((state) => state.categoryFormDraft);
  const setDraft = useFinanceStore((state) => state.setCategoryFormDraft);
  const resetDraft = useFinanceStore((state) => state.resetCategoryFormDraft);

  const allCategories = categories.length ? categories : DEFAULT_CATEGORIES;
  const category = allCategories.find((entry) => entry.id === id);

  useEffect(() => {
    if (category) {
      setDraft({
        id: category.id,
        name: category.name,
        type: category.type,
        icon: category.icon ?? "pricetag",
        parentCategoryId: category.parentCategoryId ?? null,
        activeAccountIds: category.activeAccountIds ?? activeAccounts.map((account) => account.id),
      });
    }
    return () => {
      resetDraft({ name: "", parentCategoryId: null, icon: "pricetag" });
    };
  }, [activeAccounts, category, resetDraft, setDraft]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!category || !draft) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Category</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.missingBox}>
          <Text style={styles.helperText}>This category could not be found.</Text>
          <Pressable style={styles.saveButton} onPress={() => router.back()}>
            <Text style={styles.saveButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const icon = iconToName(draft.icon);
  const parentName =
    draft.parentCategoryId && allCategories.find((item) => item.id === draft.parentCategoryId)?.name;
  const activeIds = draft.activeAccountIds ?? activeAccounts.map((account) => account.id);
  const isSaveDisabled = !draft.name.trim();

  const toggleAccount = (accountId: string) => {
    const current = new Set(activeIds);
    if (current.has(accountId)) {
      current.delete(accountId);
    } else {
      current.add(accountId);
    }
    setDraft({ activeAccountIds: Array.from(current) });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      Alert.alert("Add a name", "Please enter a category name to continue.");
      return;
    }

    const normalizedParent = draft.parentCategoryId === draft.id ? null : draft.parentCategoryId;

    await updateCategory(draft.id!, {
      name: draft.name.trim(),
      type: draft.type,
      icon,
      parentCategoryId: normalizedParent,
      activeAccountIds: Array.from(activeIds),
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit category</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Ionicons name="create" size={14} color={theme.colors.primary} />
              <Text style={styles.badgeText}>Details</Text>
            </View>
            <Text style={styles.cardTitle}>Refresh the label and placement.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setDraft({ name: text })}
              placeholder="Category name"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </View>

          <Pressable style={styles.selectorRow} onPress={() => router.push("/categories/select-icon")}>
            <View style={styles.selectorLeft}>
              <View style={styles.selectorIcon}>
                <Ionicons name={icon} size={18} color={theme.colors.text} />
              </View>
              <View>
                <Text style={styles.selectorTitle}>Icon</Text>
                <Text style={styles.selectorSubtitle}>Pick something memorable</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable style={styles.selectorRow} onPress={() => router.push("/categories/select-parent")}>
            <View style={styles.selectorLeft}>
              <View style={[styles.selectorIcon, styles.selectorIconAlt]}>
                <Ionicons name="git-branch" size={16} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.selectorTitle}>Parent category</Text>
                <Text style={styles.selectorSubtitle}>{parentName ? parentName : "None"}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.badgeAlt}>
              <Ionicons name="wallet" size={14} color={theme.colors.text} />
              <Text style={styles.badgeAltText}>Wallet activation</Text>
            </View>
            <Text style={styles.cardTitle}>Choose where this category stays active.</Text>
          </View>

          <View style={styles.helperBox}>
            <Ionicons name="information-circle" size={16} color={theme.colors.textMuted} />
            <Text style={styles.helperText}>
              Transactions for inactive wallets will still appear in history and reports, but you won't be able to
              pick this category when adding new transactions there.
            </Text>
          </View>

          {activeAccounts.map((account) => {
            const active = activeIds.includes(account.id);
            return (
              <View key={account.id} style={styles.walletRow}>
                <View style={styles.walletInfo}>
                  <View style={styles.walletIcon}>
                    <Ionicons name="card" size={14} color={theme.colors.text} />
                  </View>
                  <View>
                    <Text style={styles.walletName}>{account.name}</Text>
                    <Text style={styles.walletMeta}>{account.currency}</Text>
                  </View>
                </View>
                <Switch
                  value={active}
                  onValueChange={() => toggleAccount(account.id)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
          disabled={isSaveDisabled}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save changes</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    headerTitle: {
      ...theme.typography.title,
      fontSize: 18,
    },
    missingBox: {
      margin: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.md,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
    },
    cardHeader: {
      gap: theme.spacing.xs,
    },
    cardTitle: {
      ...theme.typography.subtitle,
      fontSize: 16,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      alignSelf: "flex-start",
      backgroundColor: `${theme.colors.primary}18`,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
    },
    badgeText: {
      color: theme.colors.primary,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    badgeAlt: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      alignSelf: "flex-start",
      backgroundColor: `${theme.colors.surfaceAlt}`,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: `${theme.colors.border}AA`,
    },
    badgeAltText: {
      color: theme.colors.text,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    inputGroup: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceAlt,
    },
    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.md,
    },
    selectorLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    selectorIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${theme.colors.border}AA`,
    },
    selectorIconAlt: {
      backgroundColor: `${theme.colors.primary}15`,
    },
    selectorTitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    selectorSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    helperBox: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: `${theme.colors.border}AA`,
    },
    helperText: {
      color: theme.colors.textMuted,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    walletRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
    },
    walletInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    walletIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    walletName: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    walletMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    footer: {
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    saveButton: {
      ...theme.components.buttonPrimary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.full,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      ...theme.components.buttonPrimaryText,
      fontSize: 16,
    },
  });
