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
      <View style={styles.headerContainer}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Edit Category</Text>
          <Text style={styles.subtitle}>Update category details</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[theme.components.surface, styles.formSection]}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category Name</Text>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setDraft({ name: text })}
              placeholder="Category name"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </View>
        </View>

        <View style={[theme.components.surface, styles.formSection]}>
          <Pressable style={styles.selectorRow} onPress={() => router.push("/categories/select-icon")}>
            <View style={styles.selectorIcon}>
              <Ionicons name={icon} size={20} color={theme.colors.text} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.selectorTitle}>Icon</Text>
              <Text style={styles.selectorSubtitle}>Choose an icon</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.selectorRow} onPress={() => router.push("/categories/select-parent")}>
            <View style={[styles.selectorIcon, styles.selectorIconAlt]}>
              <Ionicons name="git-branch" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.selectorTitle}>Parent Category</Text>
              <Text style={styles.selectorSubtitle}>{parentName || "None (top-level)"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={[theme.components.surface, styles.formSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Wallets</Text>
            <Text style={styles.sectionSubtitle}>Choose where this category is available</Text>
          </View>

          {activeAccounts.map((account) => {
            const active = activeIds.includes(account.id);
            return (
              <View key={account.id} style={styles.walletRow}>
                <View style={styles.walletInfo}>
                  <View style={styles.walletIcon}>
                    <Ionicons name="card" size={16} color={theme.colors.text} />
                  </View>
                  <View style={styles.flex}>
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

        <View style={styles.helperCard}>
          <Ionicons name="information-circle" size={18} color={theme.colors.textMuted} />
          <Text style={styles.helperText}>
            Inactive wallet transactions will still appear in reports but you can&apos;t use this category for new transactions
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
          disabled={isSaveDisabled}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save</Text>
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
    headerContainer: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    headerText: {
      gap: 4,
    },
    title: {
      fontSize: theme.screen.isSmallDevice ? 20 : 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    missingBox: {
      margin: theme.spacing.md,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    },
    content: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingBottom: 120,
      gap: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
    },
    formSection: {
      padding: theme.spacing.md,
      gap: theme.spacing.lg,
    },
    fieldGroup: {
      gap: theme.spacing.sm,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      ...theme.components.input,
      fontSize: 15,
    },
    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    selectorIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    selectorIconAlt: {
      backgroundColor: `${theme.colors.primary}15`,
    },
    flex: {
      flex: 1,
    },
    selectorTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    selectorSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    sectionHeader: {
      gap: 4,
      marginBottom: theme.spacing.xs,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    walletRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    walletInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    walletIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    walletName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    walletMeta: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    helperCard: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      alignItems: "flex-start",
    },
    helperText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textMuted,
    },
    footer: {
      flexDirection: "row",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radii.pill,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      ...theme.components.buttonPrimary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
  });
