import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { isAuthenticated } from "../../lib/supabase";
import { syncMetricsToSupabase, fetchLeaderboard, getUserRank } from "../../lib/sync-service";
import { useFinanceStore } from "../../lib/store";
import AuthForm from "../../components/AuthForm";
import { 
  mockMissions, 
  mockAchievements,
  mockLeaderboardData,
  calculateLevel, 
  levelProgress, 
  pointsForNextLevel,
  getTimeRemaining,
  type MockMission,
  type MockAchievement 
} from "../../lib/crew-mock-data";

export default function CrewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all_time'>('all_time');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  
  const transactions = useFinanceStore((state) => state.transactions);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  
  // Mock user stats
  const [userPoints, setUserPoints] = useState(850);
  const [userStreak, setUserStreak] = useState(5);
  const userLevel = calculateLevel(userPoints);
  const levelPercent = levelProgress(userPoints, userLevel);
  const nextLevelPoints = pointsForNextLevel(userLevel);

  const checkAuth = async () => {
    const auth = await isAuthenticated();
    setIsAuth(auth);
    if (auth) {
      await loadLeaderboard();
    }
    setIsLoading(false);
    return auth;
  };

  const loadLeaderboard = async () => {
    const result = await fetchLeaderboard(period);
    if (result.success && result.data && result.data.length > 0) {
      setLeaderboardData(result.data);
    } else {
      // Use mock data if no real data available
      setLeaderboardData(mockLeaderboardData);
    }

    const rankResult = await getUserRank(period);
    if (rankResult.success && rankResult.rank) {
      setUserRank(rankResult.rank);
    } else {
      // Mock rank for demo
      setUserRank(7);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await syncMetricsToSupabase(transactions, budgetGoals);
    await loadLeaderboard();
    setIsRefreshing(false);
  }, [transactions, budgetGoals, period]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuth) {
      loadLeaderboard();
    }
  }, [period]);

  const renderMission = (mission: MockMission) => (
    <View key={mission.id} style={styles.missionCard}>
      <View style={styles.missionHeader}>
        <View style={[styles.missionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name={mission.icon as any} size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.missionHeaderText}>
          <Text style={styles.missionTitle}>{mission.title}</Text>
          <Text style={styles.missionTime}>
            {mission.ends_at ? getTimeRemaining(mission.ends_at) : 'No deadline'}
          </Text>
        </View>
        <View style={styles.missionReward}>
          <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
          <Text style={styles.missionRewardText}>+{mission.points_reward}</Text>
        </View>
      </View>
      
      <Text style={styles.missionDescription}>{mission.description}</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${mission.progress || 0}%`, backgroundColor: theme.colors.success }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{mission.progress || 0}%</Text>
      </View>
    </View>
  );

  const renderAchievement = (achievement: MockAchievement) => (
    <View 
      key={achievement.id} 
      style={[
        styles.achievementCard,
        !achievement.unlocked && styles.achievementLocked
      ]}
    >
      <Text style={styles.achievementIcon}>{achievement.icon}</Text>
      <View style={styles.achievementContent}>
        <Text style={[styles.achievementTitle, !achievement.unlocked && styles.textMuted]}>
          {achievement.title}
        </Text>
        <Text style={[styles.achievementDescription, !achievement.unlocked && styles.textMuted]}>
          {achievement.description}
        </Text>
        <Text style={styles.achievementPoints}>+{achievement.points_value} pts</Text>
      </View>
      {achievement.unlocked && (
        <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
      )}
      {!achievement.unlocked && (
        <Ionicons name="lock-closed" size={24} color={theme.colors.textMuted} />
      )}
    </View>
  );

  if (!isAuth) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Crew</Text>
          <Text style={styles.subtitle}>Sign in to join missions and compete</Text>
        </View>
        <View style={[theme.components.surface, styles.authContainer]}>
          <AuthForm onSuccess={() => checkAuth()} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Crew</Text>
          <Text style={styles.subtitle}>Complete missions and earn rewards</Text>
        </View>

        {/* Player Card */}
        <View style={[theme.components.card, styles.playerCard]}>
          <View style={styles.playerHeader}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={32} color={theme.colors.primary} />
              </View>
              <View style={[styles.levelBadge, { backgroundColor: theme.colors.success }]}>
                <Text style={styles.levelBadgeText}>{userLevel}</Text>
              </View>
            </View>
            
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>Josh77</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="flame" size={16} color="#FF6B35" />
                  <Text style={styles.statText}>{userStreak} days</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
                  <Text style={styles.statText}>{userPoints} pts</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Level Progress */}
          <View style={styles.levelProgress}>
            <View style={styles.levelProgressHeader}>
              <Text style={styles.levelProgressText}>Level {userLevel}</Text>
              <Text style={styles.levelProgressText}>Level {userLevel + 1}</Text>
            </View>
            <View style={styles.levelProgressBar}>
              <View 
                style={[
                  styles.levelProgressFill, 
                  { 
                    width: `${levelPercent}%`,
                    backgroundColor: theme.colors.primary 
                  }
                ]} 
              />
            </View>
            <Text style={styles.levelProgressSubtext}>
              {nextLevelPoints - userPoints} pts to next level
            </Text>
          </View>

          {/* View Crew Button */}
          <Pressable 
            style={styles.viewCrewButton}
            onPress={() => router.push('/crew/your-crew' as any)}
          >
            <Ionicons name="people" size={18} color={theme.colors.primary} />
            <Text style={styles.viewCrewButtonText}>View Crew</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="podium" size={24} color={theme.colors.accent} />
            <Text style={styles.sectionTitle}>Leaderboard</Text>
          </View>
          
          {userRank && (
            <View style={[theme.components.surface, styles.rankCard]}>
              <Text style={styles.rankLabel}>Your Rank</Text>
              <View style={styles.rankBadge}>
                <Text style={styles.rankNumber}>#{userRank}</Text>
              </View>
            </View>
          )}

          {/* Period Filter */}
          <View style={styles.periodSelector}>
            {(['daily', 'weekly', 'monthly', 'all_time'] as const).map((p) => {
              const isActive = period === p;
              const label = p === 'all_time' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1);
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
            })}
          </View>

          {leaderboardData.length === 0 ? (
            <View style={styles.emptyLeaderboard}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No rankings yet</Text>
              <Text style={styles.emptySubtext}>Be the first to sync your stats!</Text>
            </View>
          ) : (
            leaderboardData.slice(0, 10).map((entry, index) => (
              <View key={entry.user_id} style={[theme.components.surface, styles.leaderboardCard]}>
                <View style={[
                  styles.leaderboardRank,
                  index === 0 && { backgroundColor: '#FFD700' },
                  index === 1 && { backgroundColor: '#C0C0C0' },
                  index === 2 && { backgroundColor: '#CD7F32' },
                ]}>
                  <Text style={[
                    styles.leaderboardRankText,
                    index < 3 && { color: '#000' }
                  ]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.leaderboardInfo}>
                  <Text style={styles.leaderboardName}>
                    {entry.profiles?.display_name || entry.profiles?.username || 'Anonymous'}
                  </Text>
                  <Text style={styles.leaderboardStats}>
                    Level {entry.level} • {entry.total_points} pts
                    {entry.streak_days > 0 ? ` • ${entry.streak_days}d streak` : ''}
                  </Text>
                </View>
                <Ionicons name="sparkles" size={18} color={theme.colors.accent} />
              </View>
            ))
          )}
        </View>

        {/* Active Missions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="rocket" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Active Missions</Text>
          </View>
          {mockMissions.map(renderMission)}
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={24} color={theme.colors.accent} />
            <Text style={styles.sectionTitle}>Achievements</Text>
          </View>
          {mockAchievements.map(renderAchievement)}
        </View>
      </ScrollView>
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
    },
    scrollContent: {
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xxl * 3 + insets.bottom,
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
    authContainer: {
      padding: theme.spacing.xl,
      marginTop: theme.spacing.lg,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Player Card
    playerCard: {
      marginBottom: theme.spacing.xl,
    },
    playerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.primary,
    },
    levelBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.surface,
    },
    levelBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    playerInfo: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    playerName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    statsRow: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },

    
    // Level Progress
    levelProgress: {
      gap: theme.spacing.sm,
    },
    levelProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    levelProgressText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    levelProgressBar: {
      height: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 4,
      overflow: 'hidden',
    },
    levelProgressFill: {
      height: '100%',
      borderRadius: 4,
    },
    levelProgressSubtext: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },

    // View Crew Button
    viewCrewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.primary + '20',
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.primary + '40',
      marginTop: theme.spacing.lg,
    },
    viewCrewButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.primary,
      flex: 1,
      textAlign: 'center',
    },
    
    // Sections
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    
    // Mission Cards
    missionCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    missionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    missionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    missionHeaderText: {
      flex: 1,
      gap: 2,
    },
    missionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    missionTime: {
      fontSize: 12,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    missionReward: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.accent + '20',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: 12,
    },
    missionRewardText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.accent,
    },
    missionDescription: {
      fontSize: 14,
      color: theme.colors.textMuted,
      lineHeight: 20,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    progressBar: {
      flex: 1,
      height: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      minWidth: 40,
      textAlign: 'right',
    },
    
    // Achievement Cards
    achievementCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    achievementLocked: {
      opacity: 0.6,
    },
    achievementIcon: {
      fontSize: 32,
    },
    achievementContent: {
      flex: 1,
      gap: 2,
    },
    achievementTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    achievementDescription: {
      fontSize: 13,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    achievementPoints: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.accent,
      marginTop: 2,
    },
    textMuted: {
      opacity: 0.7,
    },

    // Leaderboard
    rankCard: {
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rankLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rankBadge: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.pill,
    },
    rankNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
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
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    periodButtonTextActive: {
      color: theme.colors.text,
    },
    emptyLeaderboard: {
      alignItems: 'center',
      padding: theme.spacing.xxl,
      gap: theme.spacing.sm,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    leaderboardCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.lg,
    },
    leaderboardRank: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaderboardRankText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    leaderboardInfo: {
      flex: 1,
      gap: 4,
    },
    leaderboardName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    leaderboardStats: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  });
