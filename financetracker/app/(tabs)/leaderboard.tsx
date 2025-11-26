import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import { fetchLeaderboard, getUserRank } from "../../lib/sync-service";
import { isAuthenticated } from "../../lib/supabase";
import AuthForm from "../../components/AuthForm";

type Period = 'daily' | 'weekly' | 'monthly' | 'all_time';

interface LeaderboardEntry {
  user_id: string;
  total_points: number;
  level: number;
  streak_days: number;
  savings_percentage: number | null;
  profiles: {
    username: string;
    display_name: string | null;
  };
}

export default function LeaderboardScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('all_time');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);

  const checkAuth = async () => {
    const auth = await isAuthenticated();
    setIsAuth(auth);
    return auth;
  };

  const loadLeaderboard = async () => {
    const auth = await checkAuth();
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const result = await fetchLeaderboard(period);
    if (result.success && result.data) {
      setLeaderboard(result.data as LeaderboardEntry[]);
    }

    const rankResult = await getUserRank(period);
    if (rankResult.success && rankResult.rank) {
      setUserRank(rankResult.rank);
    }

    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeaderboard();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const renderPeriodButton = (p: Period, label: string) => {
    const isActive = period === p;
    return (
      <Pressable
        key={p}
        style={[styles.periodButton, isActive && styles.periodButtonActive]}
        onPress={() => setPeriod(p)}
      >
        <Text style={[styles.periodButtonText, isActive && styles.periodButtonTextActive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  if (!isAuth) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Sign in to compete and view rankings</Text>
        </View>
        <View style={[theme.components.surface, styles.authContainer]}>
          <AuthForm onSuccess={() => loadLeaderboard()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>
          {userRank ? `Your rank: #${userRank}` : 'Compete with others'}
        </Text>
      </View>

      <View style={styles.periodSelector}>
        {renderPeriodButton('daily', 'Day')}
        {renderPeriodButton('weekly', 'Week')}
        {renderPeriodButton('monthly', 'Month')}
        {renderPeriodButton('all_time', 'All Time')}
      </View>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No leaderboard data yet</Text>
          <Text style={styles.emptySubtext}>Be the first to sync your stats!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.lg }} />}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          renderItem={({ item, index }) => (
            <View style={[theme.components.surface, styles.card]}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.leaderInfo}>
                <Text style={styles.leaderName}>
                  {item.profiles?.display_name || item.profiles?.username || 'Anonymous'}
                </Text>
                <Text style={styles.leaderMeta}>
                  Level {item.level} • {item.total_points} pts
                  {item.streak_days > 0 ? ` • ${item.streak_days}d streak` : ''}
                </Text>
              </View>
              <Ionicons name="sparkles" size={18} color={theme.colors.accent} />
            </View>
          )}
        />
      )}
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
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xl + insets.bottom,
    },
    header: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    title: {
      ...theme.typography.title,
    },
    subtitle: {
      ...theme.typography.subtitle,
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
    periodSelector: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    periodButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    periodButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    periodButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    periodButtonTextActive: {
      color: theme.colors.text,
    },
    authContainer: {
      padding: theme.spacing.xl,
      marginTop: theme.spacing.lg,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    emptyText: {
      ...theme.typography.body,
      fontSize: 18,
      fontWeight: '600',
    },
    emptySubtext: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
  });
