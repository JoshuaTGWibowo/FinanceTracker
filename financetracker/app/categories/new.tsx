import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { DEFAULT_CATEGORIES, type CategoryType } from "../../lib/types";
import { useFinanceStore } from "../../lib/store";

const ICON_OPTIONS: (keyof typeof Ionicons.glyphMap)[] = [
  "pricetag",
  "cart",
  "fast-food",
  "restaurant",
  "home",
  "car",
  "airplane",
  "paw",
  "briefcase",
  "gift",
  "cash",
  "trending-up",
  "heart",
  "barbell",
  "leaf",
  "book",
  "color-palette",
  "school",
  "flash",
  "musical-notes",
  "ice-cream",
  "bed",
];

const CATEGORY_TABS: { label: string; value: CategoryType }[] = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Debt/Loan", value: "debt" },
];

export default function NewCategoryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const addCategory = useFinanceStore((state) => state.addCategory);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const availableCategories = categories.length ? categories : DEFAULT_CATEGORIES;

  const initialTypeParam = params.type as CategoryType | undefined;
  const [type, setType] = useState<CategoryType>(initialTypeParam ?? "expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<keyof typeof Ionicons.glyphMap>("pricetag");
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const parentOptions = useMemo(
    () => availableCategories.filter((category) => category.type === type),
    [availableCategories, type],
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Add a name", "Please enter a category name to continue.");
      return;
    }

    await addCategory({ name, type, icon, parentCategoryId });
    router.back();
  };

  const isSaveDisabled = !name.trim();

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
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={styles.tabRow}>
            {CATEGORY_TABS.map((tab) => {
              const active = tab.value === type;
              return (
                <Pressable
                  key={tab.value}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                  onPress={() => setType(tab.value)}
                >
                  <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((option) => {
                const active = option === icon;
                return (
                  <Pressable
                    key={option}
                    style={[styles.iconPill, active && styles.iconPillActive]}
                    onPress={() => setIcon(option)}
                  >
                    <Ionicons
                      name={option}
                      size={18}
                      color={active ? theme.colors.text : theme.colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Parent category (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.parentRow}>
              <Pressable
                onPress={() => setParentCategoryId(null)}
                style={[styles.parentChip, parentCategoryId === null && styles.parentChipActive]}
              >
                <Text style={[styles.parentChipText, parentCategoryId === null && styles.parentChipTextActive]}>
                  None
                </Text>
              </Pressable>
              {parentOptions.map((option) => {
                const active = option.id === parentCategoryId;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setParentCategoryId(option.id)}
                    style={[styles.parentChip, active && styles.parentChipActive]}
                  >
                    <Text style={[styles.parentChipText, active && styles.parentChipTextActive]}>
                      {option.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.noteBox}>
            <Ionicons name="information-circle" size={16} color={theme.colors.textMuted} />
            <Text style={styles.noteText}>
              New categories are active in all of your current wallets by default.
            </Text>
          </View>
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
    sectionTitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
      textTransform: "uppercase",
    },
    tabRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    tabChip: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
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
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
    },
    fieldGroup: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
    },
    iconGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    iconPill: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    iconPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    parentRow: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    parentChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    parentChipActive: {
      backgroundColor: `${theme.colors.primary}22`,
      borderColor: theme.colors.primary,
    },
    parentChipText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    parentChipTextActive: {
      color: theme.colors.primary,
    },
    noteBox: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
    },
    noteText: {
      color: theme.colors.textMuted,
      flex: 1,
      fontSize: 13,
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
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      ...theme.components.buttonPrimaryText,
    },
  });
