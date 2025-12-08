import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

const toIconName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export default function CategoriesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const categories = useFinanceStore((state) => state.preferences.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const items = categories.length ? categories : DEFAULT_CATEGORIES;

  const [activeTab, setActiveTab] = useState<CategoryType>("expense");
  const [query, setQuery] = useState("");

  const accountLabel =
    activeAccounts.length === 1 ? activeAccounts[0].name : `${activeAccounts.length} wallets`;

  const groupedCategories = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    const matchesSearch = (category: Category) =>
      searchText ? category.name.toLowerCase().includes(searchText) : true;

    const candidates = items.filter((category) => category.type === activeTab);
    const childrenMap = new Map<string, Category[]>();

    candidates.forEach((category) => {
      if (category.parentCategoryId) {
        const children = childrenMap.get(category.parentCategoryId) ?? [];
        children.push(category);
        childrenMap.set(category.parentCategoryId, children);
      }
    });

    const parents = candidates.filter((category) => !category.parentCategoryId);
    const orphans = candidates.filter(
      (category) => category.parentCategoryId && !parents.find((parent) => parent.id === category.parentCategoryId),
    );

    const groups = [
      ...parents.map((parent) => ({ parent, children: childrenMap.get(parent.id) ?? [] })),
      ...orphans.map((parent) => ({ parent, children: [] })),
    ];

    return groups
      .map((group) => {
        const visibleChildren = searchText
          ? group.children.filter((child) => matchesSearch(child))
          : group.children;
        return {
          ...group,
          children: visibleChildren,
          visible: matchesSearch(group.parent) || visibleChildren.length > 0,
        };
      })
      .filter((group) => group.visible)
      .sort((a, b) => a.parent.name.localeCompare(b.parent.name));
  }, [activeTab, items, query]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const walletSummary = (category: Category) => {
    const active = category.activeAccountIds ?? activeAccounts.map((account) => account.id);
    if (!activeAccounts.length) return "Active";
    if (active.length === activeAccounts.length) {
      return "Active in all wallets";
    }
    return `Active in ${active.length}/${activeAccounts.length} wallets`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.backgroundAccent} />
      <View style={styles.headerContainer}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Categories</Text>
          <Text style={styles.subtitle}>Organize spending & income</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[theme.components.surface, styles.formCard]}>
          <View style={styles.formHeader}>
            <View style={styles.formIconContainer}>
              <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.formTitle}>New Category</Text>
              <Text style={styles.formSubtitle}>Create expense, income, or debt category</Text>
            </View>
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push({ pathname: "/categories/new", params: { type: activeTab } })}
          >
            <Ionicons name="add" size={18} color={theme.colors.text} />
            <Text style={styles.primaryButtonText}>Create category</Text>
          </Pressable>
        </View>

        <View style={[theme.components.surface, styles.controlsCard]}>
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
            {query ? (
              <Pressable onPress={() => setQuery("")}> 
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {groupedCategories.length === 0 && (
          <Text style={styles.emptyText}>No categories yet.</Text>
        )}

        <View style={styles.grid}>
          {groupedCategories.map((group) => {
            const iconName = toIconName(group.parent.icon);
            return (
              <View key={group.parent.id} style={[theme.components.surface, styles.categoryCard]}>
                <Pressable
                  style={styles.parentRow}
                  onPress={() => router.push({ pathname: `/categories/${group.parent.id}` as any })}
                >
                  <View style={styles.parentIcon}>
                    <Ionicons name={iconName} size={18} color={theme.colors.text} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.parentName}>{group.parent.name}</Text>
                    <Text style={styles.metaText}>{walletSummary(group.parent)}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: `/categories/${group.parent.id}` as any })}
                    style={styles.editButton}
                  >
                    <Ionicons name="create-outline" size={16} color={theme.colors.text} />
                  </Pressable>
                </Pressable>

                {group.children.length > 0 ? (
                  <View style={styles.childrenList}>
                    {group.children.map((child, index) => {
                      const isLast = index === group.children.length - 1;
                      const childIcon = toIconName(child.icon);
                      return (
                        <Pressable
                          key={child.id}
                          style={styles.childRow}
                          onPress={() => router.push({ pathname: `/categories/${child.id}` as any })}
                        >
                          <View style={styles.connectorColumn}>
                            <View style={[styles.connectorLine, isLast && styles.connectorLineEnd]} />
                            <View style={styles.connectorDot} />
                          </View>
                          <View style={styles.childIcon}>
                            <Ionicons name={childIcon} size={14} color={theme.colors.text} />
                          </View>
                          <View style={styles.flex}>
                            <Text style={styles.childName}>{child.name}</Text>
                            <Text style={styles.metaText}>{walletSummary(child)}</Text>
                          </View>
                          <Pressable
                            onPress={() => router.push({ pathname: `/categories/${child.id}` as any })}
                            style={styles.editButton}
                          >
                            <Ionicons name="create-outline" size={14} color={theme.colors.text} />
                          </Pressable>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
      position: "relative" as const,
    },
    backgroundAccent: {
      position: "absolute" as const,
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
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.screen.isSmallDevice ? theme.spacing.md : theme.spacing.lg,
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
      fontSize: theme.screen.isSmallDevice ? 20 : 24,
      fontWeight: "700",
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      marginTop: 2,
    },
    content: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      gap: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
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
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    controlsCard: {
      gap: theme.spacing.md,
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
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      paddingVertical: 4,
    },
    grid: {
      gap: theme.spacing.sm,
    },
    categoryCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    parentIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    parentName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    metaText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    editButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    childrenList: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.background,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      gap: 4,
      marginTop: theme.spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    connectorColumn: {
      width: 24,
      alignItems: "center",
      position: "relative" as const,
    },
    connectorLine: {
      position: "absolute" as const,
      left: 11,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: theme.colors.primary,
      opacity: 0.3,
    },
    connectorLineEnd: {
      bottom: 14,
    },
    connectorDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.primary,
      marginTop: 8,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    childIcon: {
      width: 30,
      height: 30,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    childName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
  });
