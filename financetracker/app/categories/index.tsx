import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { DEFAULT_CATEGORIES, type Category, type CategoryType } from "../../lib/types";
import { useFinanceStore } from "../../lib/store";

const CATEGORY_TABS: { label: string; value: CategoryType }[] = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Debt/Loan", value: "debt" },
];

export default function CategoriesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const categories = useFinanceStore((state) => state.preferences.categories);
  const items = categories.length ? categories : DEFAULT_CATEGORIES;

  const [activeTab, setActiveTab] = useState<CategoryType>("expense");
  const [query, setQuery] = useState("");

  const filteredCategories = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    return items
      .filter((category) => category.type === activeTab)
      .filter((category) => (searchText ? category.name.toLowerCase().includes(searchText) : true));
  }, [activeTab, items, query]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderCategory = ({ item }: { item: Category }) => {
    const iconName = (item.icon as keyof typeof Ionicons.glyphMap) || "pricetag";
    return (
      <View style={styles.categoryRow}>
        <View style={styles.categoryLeft}>
          <View style={styles.categoryIcon}>
            <Ionicons name={iconName} size={18} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryMeta}>Active in all wallets</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      </View>
    );
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
        <Text style={styles.headerTitle}>Categories</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.controlsCard}>
        <View style={styles.tabRow}>
          {CATEGORY_TABS.map((tab) => {
            const active = tab.value === activeTab;
            return (
              <Pressable
                key={tab.value}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTab(tab.value)}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <Pressable
          style={styles.newCategoryButton}
          onPress={() => router.push({ pathname: "/categories/new", params: { type: activeTab } })}
        >
          <Ionicons name="add-circle" size={18} color={theme.colors.primary} />
          <Text style={styles.newCategoryText}>New category</Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No categories yet.</Text>}
      />
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
    controlsCard: {
      marginHorizontal: theme.spacing.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
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
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      paddingVertical: 4,
    },
    newCategoryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    newCategoryText: {
      ...theme.typography.subtitle,
      color: theme.colors.primary,
    },
    listContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    categoryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
    },
    categoryLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}1A`,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryName: {
      ...theme.typography.subtitle,
      fontSize: 15,
    },
    categoryMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    emptyText: {
      color: theme.colors.textMuted,
      textAlign: "center",
      marginTop: theme.spacing.xl,
    },
  });
