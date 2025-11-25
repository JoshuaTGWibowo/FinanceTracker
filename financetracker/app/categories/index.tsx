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
  const accounts = useFinanceStore((state) => state.accounts.filter((account) => !account.isArchived));
  const items = categories.length ? categories : DEFAULT_CATEGORIES;

  const [activeTab, setActiveTab] = useState<CategoryType>("expense");
  const [query, setQuery] = useState("");

  const accountLabel = accounts.length === 1 ? accounts[0].name : `${accounts.length} wallets`;

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
    const activeAccounts = category.activeAccountIds ?? accounts.map((account) => account.id);
    if (!accounts.length) return "Active";
    if (activeAccounts.length === accounts.length) {
      return "Active in all wallets";
    }
    return `Active in ${activeAccounts.length}/${accounts.length} wallets`;
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroBadge}>
              <Ionicons name="grid-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.heroBadgeText}>Library</Text>
            </View>
            <Text style={styles.heroTitle}>Organize how you spend, earn, and track debt.</Text>
            <Text style={styles.heroSubtitle}>Wallet: {accountLabel}</Text>
          </View>
          <Pressable
            style={styles.heroCTA}
            onPress={() => router.push({ pathname: "/categories/new", params: { type: activeTab } })}
          >
            <Ionicons name="add" size={18} color={theme.colors.text} />
            <Text style={styles.heroCTAText}>New category</Text>
          </Pressable>
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
              <View key={group.parent.id} style={styles.categoryCard}>
                <Pressable
                  style={styles.parentRow}
                  onPress={() => router.push({ pathname: `/categories/${group.parent.id}` })}
                >
                  <View style={styles.avatarCircle}>
                    <Ionicons name={iconName} size={18} color={theme.colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.parentName}>{group.parent.name}</Text>
                    <Text style={styles.metaText}>{walletSummary(group.parent)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
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
                          onPress={() => router.push({ pathname: `/categories/${child.id}` })}
                        >
                          <View style={styles.connectorColumn}>
                            <View style={[styles.connectorLine, isLast && styles.connectorLineEnd]} />
                            <View style={styles.connectorDot} />
                          </View>
                          <View style={styles.childAvatar}>
                            <Ionicons name={childIcon} size={14} color={theme.colors.text} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.childName}>{child.name}</Text>
                            <Text style={styles.metaText}>{walletSummary(child)}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
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
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
    },
    heroLeft: { flex: 1, gap: theme.spacing.xs },
    heroBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      backgroundColor: `${theme.colors.primary}18`,
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    heroBadgeText: {
      fontWeight: "700",
      color: theme.colors.primary,
      letterSpacing: 0.4,
    },
    heroTitle: {
      ...theme.typography.title,
      fontSize: 18,
      lineHeight: 24,
    },
    heroSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    heroCTA: {
      backgroundColor: theme.colors.text,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    heroCTAText: {
      color: theme.colors.background,
      fontWeight: "700",
    },
    controlsCard: {
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
    grid: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    categoryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 2,
    },
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    parentName: {
      ...theme.typography.subtitle,
      fontSize: 16,
    },
    metaText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    childrenList: {
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceAlt,
      padding: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    connectorColumn: {
      width: 20,
      alignItems: "center",
      position: "relative",
    },
    connectorLine: {
      position: "absolute",
      left: 9,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: theme.colors.border,
    },
    connectorLineEnd: {
      bottom: 12,
    },
    connectorDot: {
      width: 12,
      height: 12,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primary,
      marginTop: 6,
    },
    childAvatar: {
      width: 34,
      height: 34,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${theme.colors.border}AA`,
    },
    childName: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    emptyText: {
      color: theme.colors.textMuted,
      textAlign: "center",
      marginTop: theme.spacing.lg,
    },
  });
