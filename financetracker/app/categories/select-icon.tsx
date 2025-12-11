import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
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
  "rocket",
  "planet",
  "bicycle",
  "camera",
];

export default function SelectIconScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const draft = useFinanceStore((state) => state.categoryFormDraft);
  const setDraft = useFinanceStore((state) => state.setCategoryFormDraft);

  const selected = (draft?.icon as keyof typeof Ionicons.glyphMap) || "pricetag";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSelect = (icon: keyof typeof Ionicons.glyphMap) => {
    setDraft({ icon });
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
        <Text style={styles.headerTitle}>Choose an icon</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {ICON_OPTIONS.map((icon) => {
          const active = icon === selected;
          return (
            <Pressable
              key={icon}
              style={[styles.iconPill, active && styles.iconPillActive]}
              onPress={() => handleSelect(icon)}
            >
              <Ionicons
                name={icon}
                size={20}
                color={active ? theme.colors.text : theme.colors.textMuted}
              />
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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      padding: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      justifyContent: "center",
    },
    iconPill: {
      width: 60,
      height: 60,
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    iconPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
  });
