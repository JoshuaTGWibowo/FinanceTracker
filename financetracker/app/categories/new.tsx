import { useEffect, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { DEFAULT_CATEGORIES, type CategoryType } from "../../lib/types";
import { useFinanceStore } from "../../lib/store";

const CATEGORY_TABS: { label: string; value: CategoryType }[] = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Debt/Loan", value: "debt" },
];

const iconToName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export default function NewCategoryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const categories = useFinanceStore((state) => state.preferences.categories);
  const availableCategories = categories.length ? categories : DEFAULT_CATEGORIES;
  const accounts = useFinanceStore((state) => state.accounts);
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const addCategory = useFinanceStore((state) => state.addCategory);
  const draft = useFinanceStore((state) => state.categoryFormDraft);
  const setDraft = useFinanceStore((state) => state.setCategoryFormDraft);
  const resetDraft = useFinanceStore((state) => state.resetCategoryFormDraft);

  const initialTypeParam = (params.type as CategoryType | undefined) ?? "expense";

  useEffect(() => {
    const shouldReset = !draft || Boolean(draft.id);
    if (shouldReset) {
      resetDraft({
        name: "",
        type: initialTypeParam,
        icon: "pricetag",
        parentCategoryId: null,
        activeAccountIds: activeAccounts.map((account) => account.id),
      });
    }
  }, [activeAccounts, draft, initialTypeParam, resetDraft]);

  const type = draft?.type ?? initialTypeParam;
  const name = draft?.name ?? "";
  const icon = iconToName(draft?.icon);
  const parentCategoryId = draft?.parentCategoryId ?? null;

  const styles = useMemo(() => createStyles(theme), [theme]);

  const parentName =
    parentCategoryId && availableCategories.find((category) => category.id === parentCategoryId)?.name;

  const isSaveDisabled = !name.trim();

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Add a name", "Please enter a category name to continue.");
      return;
    }

    await addCategory({
      name: name.trim(),
      type,
      icon,
      parentCategoryId,
      activeAccountIds: draft?.activeAccountIds ?? activeAccounts.map((account) => account.id),
    });

    resetDraft({
      name: "",
      type: initialTypeParam,
      icon: "pricetag",
      parentCategoryId: null,
      activeAccountIds: activeAccounts.map((account) => account.id),
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
          <Text style={styles.title}>New Category</Text>
          <Text style={styles.subtitle}>Create a new spending category</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[theme.components.surface, styles.formSection]}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category Name</Text>
            <TextInput
              value={name}
              onChangeText={(text) => setDraft({ name: text })}
              placeholder="e.g., Coffee, Gifts, Groceries"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.tabRow}>
              {CATEGORY_TABS.map((tab) => {
                const active = tab.value === type;
                return (
                  <Pressable
                    key={tab.value}
                    style={[styles.tabChip, active && styles.tabChipActive]}
                    onPress={() => setDraft({ type: tab.value })}
                  >
                    <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={[theme.components.surface, styles.formSection]}>
          <Pressable
            style={styles.selectorRow}
            onPress={() => router.push("/categories/select-icon")}
          >
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

          <Pressable
            style={styles.selectorRow}
            onPress={() => router.push("/categories/select-parent")}
          >
            <View style={[styles.selectorIcon, styles.selectorIconAlt]}>
              <Ionicons name="git-branch" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.selectorTitle}>Parent Category</Text>
              <Text style={styles.selectorSubtitle}>
                {parentName || "None (top-level)"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.helperCard}>
          <Ionicons name="information-circle" size={18} color={theme.colors.textMuted} />
          <Text style={styles.helperText}>
            New categories are active in all wallets by default
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
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
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
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
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
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
    tabRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    tabChip: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    tabChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tabChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    tabChipTextActive: {
      color: "#fff",
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
