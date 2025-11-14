import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "../../theme";
import { SegmentedControl } from "../../components/SegmentedControl";

const mockLeaders = [
  { id: "1", name: "Alicia Jeanelly", progress: "Spark Balance +18%" },
  { id: "2", name: "Joshua Wibowo", progress: "Saved $420 this month" },
  { id: "3", name: "Timothy Gratio", progress: "Debt free streak: 6 weeks" },
];

export default function LeaderboardScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [timeframe, setTimeframe] = useState<"week" | "month">("month");

  const timeframeLabel = timeframe === "week" ? "7-day sprint" : "30-day gains";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Community</Text>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>
          Celebrate compounding wins with your crew.
        </Text>
      </View>
      <LinearGradient colors={[theme.colors.primaryMuted, theme.colors.primary]} style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Collective momentum</Text>
          <Text style={styles.heroSubtitle}>Keep your savings streak alive and unlock seasonal badges.</Text>
        </View>
        <Pressable style={styles.heroButton} accessibilityRole="button">
          <Ionicons name="flash" size={16} color={theme.colors.text} />
          <Text style={styles.heroButtonText}>Start a challenge</Text>
        </Pressable>
      </LinearGradient>
      <View style={styles.switchRow}>
        <View>
          <Text style={styles.switchLabel}>{timeframeLabel}</Text>
          <Text style={styles.switchCaption}>Top performers refresh daily.</Text>
        </View>
        <SegmentedControl
          value={timeframe}
          onChange={(next) => setTimeframe(next)}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          size="sm"
        />
      </View>
      <FlatList
        data={mockLeaders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.lg }} />}
        renderItem={({ item, index }) => {
          const badgeColors = [theme.colors.success, theme.colors.accent, theme.colors.primary];
          const badgeStyle = index < badgeColors.length ? { backgroundColor: badgeColors[index] } : null;
          return (
            <View style={[theme.components.surface, styles.card]}>
              <View style={[styles.rankBadge, badgeStyle]}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.leaderInfo}>
                <Text style={styles.leaderName}>{item.name}</Text>
                <Text style={styles.leaderMeta}>{item.progress}</Text>
              </View>
              <Ionicons name="sparkles" size={18} color={theme.colors.accent} />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
    },
    header: {
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
    kicker: {
      ...theme.typography.label,
      color: theme.colors.primary,
    },
    title: {
      ...theme.typography.title,
      fontSize: 28,
    },
    subtitle: {
      ...theme.typography.subtitle,
    },
    heroCard: {
      borderRadius: theme.radii.lg,
      padding: theme.spacing.xl,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
    },
    heroCopy: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    heroSubtitle: {
      ...theme.typography.subtitle,
      color: `${theme.colors.text}CC`,
    },
    heroButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: `${theme.colors.text}44`,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: `${theme.colors.surface}55`,
    },
    heroButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    switchCaption: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    listContent: {
      paddingBottom: theme.spacing.xxl * 1.5 + insets.bottom,
      gap: theme.spacing.lg,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.lg,
      borderRadius: theme.radii.lg,
    },
    rankBadge: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: `${theme.colors.border}66`,
      alignItems: "center",
      justifyContent: "center",
    },
    rankText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    leaderInfo: {
      gap: 4,
      flex: 1,
    },
    leaderName: {
      ...theme.typography.body,
      fontSize: 18,
      fontWeight: "600",
    },
    leaderMeta: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
  });
