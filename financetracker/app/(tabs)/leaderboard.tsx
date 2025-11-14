import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "../../theme";

const mockLeaders = [
  { id: "1", name: "Alicia Jeanelly", progress: "Spark Balance +18%" },
  { id: "2", name: "Joshua Wibowo", progress: "Saved $420 this month" },
  { id: "3", name: "Timothy Gratio", progress: "Debt free streak: 6 weeks" },
];

export default function LeaderboardScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <Text style={styles.title}>Crew leaderboard</Text>
          <Text style={styles.subtitle}>
            Celebrate every milestone and nudge friends to keep the streak alive.
          </Text>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Avg savings</Text>
            <Text style={styles.heroStatValue}>+18%</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Active players</Text>
            <Text style={styles.heroStatValue}>12</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Monthly pot</Text>
            <Text style={styles.heroStatValue}>$2.4k</Text>
          </View>
        </View>
      </LinearGradient>
      <FlatList
        data={mockLeaders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.lg }} />}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName}>{item.name}</Text>
              <Text style={styles.leaderMeta}>{item.progress}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
              <Text style={styles.metaPillText}>Boost</Text>
            </View>
          </View>
        )}
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
      gap: theme.spacing.sm,
    },
    heroCard: {
      borderRadius: theme.radii.lg * 1.2,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      borderWidth: 1,
      borderColor: `${theme.colors.border}55`,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 24,
    },
    heroHeader: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...theme.typography.title,
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 15,
    },
    heroStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    heroStat: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
    },
    heroStatLabel: {
      fontSize: 12,
      color: theme.colors.text,
      opacity: 0.75,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    heroStatValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
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
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rankBadge: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.colors.primary,
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
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.accent}22`,
    },
    metaPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.accent,
    },
  });
