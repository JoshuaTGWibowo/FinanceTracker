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
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New category</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={14} color={theme.colors.primary} />
              <Text style={styles.badgeText}>Details</Text>
            </View>
            <Text style={styles.cardTitle}>Give your category a voice.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={(text) => setDraft({ name: text })}
              placeholder="e.g. Coffee, Gifts, Tips"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.inputGroup}>
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

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.badgeAlt}>
              <Ionicons name="color-palette" size={14} color={theme.colors.text} />
              <Text style={styles.badgeAltText}>Appearance & Relationships</Text>
            </View>
            <Text style={styles.cardTitle}>Choose an icon and where it belongs.</Text>
          </View>

          <Pressable
            style={styles.selectorRow}
            onPress={() => router.push("/categories/select-icon")}
          >
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

          <Pressable
            style={styles.selectorRow}
            onPress={() => router.push("/categories/select-parent")}
          >
            <View style={styles.selectorLeft}>
              <View style={[styles.selectorIcon, styles.selectorIconAlt]}>
                <Ionicons name="git-branch" size={16} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.selectorTitle}>Parent category</Text>
                <Text style={styles.selectorSubtitle}>
                  {parentName ? parentName : "None"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.helperBox}>
            <Ionicons name="information-circle" size={16} color={theme.colors.textMuted} />
            <Text style={styles.helperText}>
              Tip: Start from the tab matching the category type (Expense, Income, or Debt/Loan) before
              adding a new one.
            </Text>
          </View>
        </View>

        <View style={styles.cardMuted}>
          <Ionicons name="wallet" size={16} color={theme.colors.textMuted} />
          <Text style={styles.helperText}>
            New categories are active in all of your current wallets by default.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
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
    cardMuted: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
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
    tabRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    tabChip: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabChipActive: {
      backgroundColor: `${theme.colors.primary}22`,
      borderColor: theme.colors.primary,
    },
    tabChipText: {
      fontWeight: "600",
      color: theme.colors.text,
    },
    tabChipTextActive: {
      color: theme.colors.primary,
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
