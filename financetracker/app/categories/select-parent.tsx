import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { DEFAULT_CATEGORIES, type Category } from "../../lib/types";
import { useFinanceStore } from "../../lib/store";

export default function SelectParentScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const categories = useFinanceStore((state) => state.preferences.categories);
  const draft = useFinanceStore((state) => state.categoryFormDraft);
  const setDraft = useFinanceStore((state) => state.setCategoryFormDraft);

  const items = categories.length ? categories : DEFAULT_CATEGORIES;
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items
      .filter((category) => category.type === (draft?.type ?? "expense"))
      .filter((category) => !category.parentCategoryId) // Only show top-level categories
      .filter((category) => (search ? category.name.toLowerCase().includes(search) : true))
      .filter((category) => category.id !== draft?.id);
  }, [draft?.id, draft?.type, items, query]);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedId = draft?.parentCategoryId ?? null;

  const handleSelect = (category: Category | null) => {
    setDraft({ parentCategoryId: category?.id ?? null });
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
        <Text style={styles.headerTitle}>Select parent</Text>
        <View style={{ width: 32 }} />
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

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Pressable
          style={[styles.option, selectedId === null && styles.optionActive]}
          onPress={() => handleSelect(null)}
        >
          <View style={styles.optionLeft}>
            <View style={styles.optionIcon}>
              <Ionicons name="remove-circle" size={18} color={theme.colors.text} />
            </View>
            <Text style={styles.optionLabel}>None</Text>
          </View>
          {selectedId === null ? <Ionicons name="checkmark" size={16} color={theme.colors.text} /> : null}
        </Pressable>

        {options.map((option) => {
          const active = option.id === selectedId;
          const iconName = (option.icon as keyof typeof Ionicons.glyphMap) || "pricetag";
          return (
            <Pressable
              key={option.id}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => handleSelect(option)}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionIcon}>
                  <Ionicons name={iconName} size={18} color={theme.colors.text} />
                </View>
                <View>
                  <Text style={styles.optionLabel}>{option.name}</Text>
                  <Text style={styles.optionSub}>Tap to nest under this parent</Text>
                </View>
              </View>
              {active ? <Ionicons name="checkmark" size={16} color={theme.colors.text} /> : null}
            </Pressable>
          );
        })}
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
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
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
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      paddingVertical: 4,
    },
    list: {
      padding: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      gap: theme.spacing.sm,
    },
    option: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    optionActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}12`,
    },
    optionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    optionLabel: {
      ...theme.typography.subtitle,
      fontSize: 15,
    },
    optionSub: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
  });
