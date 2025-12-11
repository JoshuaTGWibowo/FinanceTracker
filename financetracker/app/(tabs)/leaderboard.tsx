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
import { SkeletonLoader, SkeletonCard, SkeletonListItem } from "../../components/SkeletonLoader";
import { 
  mockAchievements,
  mockLeaderboardData,
  calculateLevel, 
  levelProgress, 
  pointsForNextLevel,
  getTimeRemaining,
  type MockMission,
  type MockAchievement 
} from "../../lib/crew-mock-data";
import { getLeaderboardStats, getLevelProgress } from "../../lib/points-service";
import { getMissionsWithProgress, type Mission } from "../../lib/mission-service";

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
  const [missionFilter, setMissionFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [missionPeriod, setMissionPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [crewMissionFilter, setCrewMissionFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [crewMissionPeriod, setCrewMissionPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isInCrew, setIsInCrew] = useState(false);
  
  const transactions = useFinanceStore((state) => state.transactions);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const profile = useFinanceStore((state) => state.profile);
  
  // Real mission data
  const [missions, setMissions] = useState<Array<Mission & { progress: number; completed: boolean }>>([]);
  const [isLoadingMissions, setIsLoadingMissions] = useState(false);
  
  // Real user stats from points service
  const [userStats, setUserStats] = useState<{
    totalPoints: number;
    level: number;
    streakDays: number;
    progress: number;
    pointsInLevel: number;
    pointsNeeded: number;
  } | null>(null);
  
  const userPoints = userStats?.totalPoints || 0;
  const userStreak = userStats?.streakDays || 0;
  const userLevel = userStats?.level || 1;
  const levelPercent = levelProgress(userPoints, userLevel);
  const nextLevelPoints = pointsForNextLevel(userLevel);

  const filteredMissions = useMemo(() => {
    // Filter individual missions by period and completion status
    let filtered = missions.filter(m => m.missionType === 'individual');
    
    // Filter by period (map period names to timeframe in description)
    filtered = filtered.filter(m => {
      const desc = m.description.toLowerCase();
      if (missionPeriod === 'daily') return desc.includes('today') || desc.includes('day');
      if (missionPeriod === 'weekly') return desc.includes('week');
      if (missionPeriod === 'monthly') return desc.includes('month');
      return false;
    });
    
    // Then filter by completion status
    if (missionFilter === 'all') return filtered;
    if (missionFilter === 'completed') return filtered.filter(m => m.completed);
    return filtered.filter(m => !m.completed);
  }, [missions, missionFilter, missionPeriod]);

  const filteredCrewMissions = useMemo(() => {
    // Filter crew missions by period and completion status
    let filtered = missions.filter(m => m.missionType === 'crew');
    
    // Filter by period (map period names to timeframe in description)
    filtered = filtered.filter(m => {
      const desc = m.description.toLowerCase();
      if (crewMissionPeriod === 'daily') return desc.includes('today') || desc.includes('day');
      if (crewMissionPeriod === 'weekly') return desc.includes('week');
      if (crewMissionPeriod === 'monthly') return desc.includes('month');
      return false;
    });
    
    // Then filter by completion status
    if (crewMissionFilter === 'all') return filtered;
    if (crewMissionFilter === 'completed') return filtered.filter(m => m.completed);
    return filtered.filter(m => !m.completed);
  }, [missions, crewMissionFilter, crewMissionPeriod]);

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
    if (result.success && result.data) {
      setLeaderboardData(result.data);
      setIsInCrew(result.data.length > 0); // User is in crew if there's leaderboard data
    } else {
      // Empty leaderboard if not in a crew or error
      setLeaderboardData([]);
      setIsInCrew(false);
    }

    const rankResult = await getUserRank(period);
    if (rankResult.success && rankResult.rank) {
      setUserRank(rankResult.rank);
    } else {
      // No rank if not in crew
      setUserRank(null);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await syncMetricsToSupabase(transactions, budgetGoals);
    await loadLeaderboard();
    await loadUserStats();
    await loadMissions();
    setIsRefreshing(false);
  }, [transactions, budgetGoals, period, userStats]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuth) {
      loadLeaderboard();
      loadUserStats();
    }
  }, [period]);

  // Load user stats from points service
  useEffect(() => {
    if (isAuth) {
      loadUserStats();
    }
  }, [transactions.length, isAuth]);

  // Load missions when authenticated or transactions change
  useEffect(() => {
    if (isAuth && userStats) {
      console.log(`[Leaderboard] Transactions changed (${transactions.length}), reloading missions...`);
      loadMissions();
    }
  }, [transactions, isAuth, userStats?.streakDays, profile.timezone]);

  const loadUserStats = async () => {
    const result = await getLeaderboardStats();
    if (result.success && result.stats) {
      const levelInfo = getLevelProgress(result.stats.totalPoints);
      setUserStats({
        totalPoints: result.stats.totalPoints,
        level: result.stats.level,
        streakDays: result.stats.streakDays,
        progress: levelInfo.progress,
        pointsInLevel: levelInfo.pointsInLevel,
        pointsNeeded: levelInfo.pointsNeeded,
      });
    }
  };

  const loadMissions = async () => {
    if (!isAuth) return;
    
    setIsLoadingMissions(true);
    console.log(`[Leaderboard] Loading missions with ${transactions.length} transactions`);
    
    const result = await getMissionsWithProgress(
      transactions,
      userStats?.streakDays || 0,
      'all' // Get all missions, we'll filter in the UI
    );
    
    if (result.success && result.missions) {
      console.log(`[Leaderboard] Loaded ${result.missions.length} missions`);
      result.missions.forEach(m => {
        console.log(`[Leaderboard] - ${m.title}: ${m.progress.toFixed(1)}% (${m.goalType})`);
      });
      setMissions(result.missions);
    } else {
      console.log('[Leaderboard] Failed to load missions:', result.error);
    }
    setIsLoadingMissions(false);
  };

  // Map goal types to icons
  const getMissionIcon = (goalType: string): string => {
    switch (goalType) {
      case 'transactions_logged': return 'list';
      case 'streak': return 'flame';
      case 'savings_rate': return 'trending-up';
      case 'budget_adherence': return 'checkmark-circle';
      default: return 'trophy';
    }
  };

  const renderMission = (mission: Mission & { progress: number; completed: boolean }, index: number, array: Array<Mission & { progress: number; completed: boolean }>) => (
    <View key={mission.id} style={[styles.missionCard, index === array.length - 1 && styles.lastItem]}>
      <View style={styles.missionHeader}>
        <View style={[styles.missionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name={getMissionIcon(mission.goalType) as any} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.missionHeaderText}>
          <Text style={styles.missionTitle}>{mission.title}</Text>
          <Text style={styles.missionTime}>
            {mission.endsAt ? getTimeRemaining(mission.endsAt) : 'No deadline'}
          </Text>
        </View>
        <View style={styles.missionReward}>
          <Ionicons name="sparkles" size={14} color={theme.colors.accent} />
          <Text style={styles.missionRewardText}>+{mission.pointsReward}</Text>
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
        <Text style={styles.progressText}>{Math.round(mission.progress || 0)}%</Text>
      </View>
    </View>
  );

  const renderAchievement = (achievement: MockAchievement, index: number, array: MockAchievement[]) => {
    // Mock progress for locked achievements (in real app, this would come from backend)
    const mockProgress = !achievement.unlocked ? {
      current: achievement.id === '3' ? 7 : achievement.id === '4' ? 45 : achievement.id === '5' ? 2 : 15,
      total: achievement.id === '3' ? 10 : achievement.id === '4' ? 100 : achievement.id === '5' ? 5 : 30,
    } : null;

    const progressPercent = mockProgress ? (mockProgress.current / mockProgress.total) * 100 : 0;

    return (
      <View 
        key={achievement.id} 
        style={[
          styles.achievementCard,
          !achievement.unlocked && styles.achievementLocked,
          index === array.length - 1 && styles.lastItem
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
          {!achievement.unlocked && mockProgress && (
            <View style={styles.achievementProgressContainer}>
              <View style={styles.achievementProgressBar}>
                <View 
                  style={[
                    styles.achievementProgressFill,
                    { width: `${progressPercent}%`, backgroundColor: theme.colors.primary }
                  ]} 
                />
              </View>
              <Text style={styles.achievementProgressText}>
                {mockProgress.current}/{mockProgress.total}
              </Text>
            </View>
          )}
          <Text style={styles.achievementPoints}>+{achievement.points_value} pts</Text>
        </View>
        {achievement.unlocked && (
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
        )}
        {!achievement.unlocked && (
          <Ionicons name="lock-closed" size={20} color={theme.colors.textMuted} />
        )}
      </View>
    );
  };

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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Crew</Text>
            <Text style={styles.subtitle}>Loading...</Text>
          </View>
          
          {/* Player Card Skeleton */}
          <View style={[theme.components.card, styles.playerCard]}>
            <View style={styles.playerHeader}>
              <SkeletonLoader width={64} height={64} borderRadius={32} />
              <View style={styles.playerInfo}>
                <SkeletonLoader height={20} width="60%" style={{ marginBottom: 8 }} />
                <SkeletonLoader height={14} width="40%" />
              </View>
            </View>
            <SkeletonLoader height={8} style={{ marginVertical: 12 }} />
            <SkeletonLoader height={40} style={{ marginTop: 12 }} />
          </View>
          
          {/* Leaderboard Skeleton */}
          <SkeletonCard style={{ marginBottom: 16 }} />
          
          {/* Missions Skeleton */}
          <View style={[theme.components.card, styles.sectionCard]}>
            <View style={styles.sectionHeader}>
              <SkeletonLoader width={100} height={20} />
            </View>
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} style={{ paddingHorizontal: 16 }} />
            ))}
          </View>
        </ScrollView>
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
                    width: `${userStats?.progress || 0}%`,
                    backgroundColor: theme.colors.primary 
                  }
                ]} 
              />
            </View>
            <Text style={styles.levelProgressSubtext}>
              {userStats ? `${userStats.pointsNeeded - userStats.pointsInLevel} pts to next level` : 'Loading...'}
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
        <View style={[theme.components.card, styles.sectionCard]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="podium" size={20} color={theme.colors.accent} />
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
              <Text style={styles.emptyText}>Join a crew to see rankings</Text>
              <Text style={styles.emptySubtext}>Create or join a crew to compete with friends!</Text>
              <Pressable 
                style={[styles.viewCrewButton, { marginTop: 16 }]}
                onPress={() => router.push('/crew/your-crew' as any)}
              >
                <Ionicons name="people" size={18} color={theme.colors.primary} />
                <Text style={styles.viewCrewButtonText}>Go to Crew</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : (
            leaderboardData.slice(0, 10).map((entry, index, array) => (
              <View key={entry.user_id} style={[theme.components.surface, styles.leaderboardCard, index === array.length - 1 && styles.lastItem]}>
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
                <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
              </View>
            ))
          )}
        </View>

        {/* Active Missions */}
        <View style={[theme.components.card, styles.sectionCard]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="rocket" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Missions</Text>
          </View>

          {/* Mission Status Filter */}
          <View style={styles.missionFilter}>
            {(['active', 'completed', 'all'] as const).map((filter) => {
              const isActive = missionFilter === filter;
              const label = filter.charAt(0).toUpperCase() + filter.slice(1);
              return (
                <Pressable
                  key={filter}
                  style={[styles.filterButton, isActive && styles.filterButtonActive]}
                  onPress={() => setMissionFilter(filter)}
                >
                  <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Mission Period Selector */}
          <View style={[styles.missionFilter, { marginTop: 0 }]}>
            {(['daily', 'weekly', 'monthly'] as const).map((period) => {
              const isActive = missionPeriod === period;
              const label = period.charAt(0).toUpperCase() + period.slice(1);
              return (
                <Pressable
                  key={period}
                  style={[styles.filterButton, isActive && styles.filterButtonActive]}
                  onPress={() => setMissionPeriod(period)}
                >
                  <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {filteredMissions.length === 0 ? (
            <View style={styles.emptyMissions}>
              <Ionicons 
                name={missionFilter === 'completed' ? "trophy-outline" : "checkmark-circle"} 
                size={48} 
                color={missionFilter === 'completed' ? theme.colors.textMuted : theme.colors.success} 
              />
              <Text style={styles.emptyText}>
                {missionFilter === 'completed' 
                  ? 'No completed missions yet' 
                  : 'All missions completed!'}
              </Text>
              {missionFilter === 'completed' && (
                <Text style={styles.emptySubtext}>Complete active missions to see them here</Text>
              )}
            </View>
          ) : (
            filteredMissions.map(renderMission)
          )}
        </View>

        {/* Crew Missions - Only show if user is in a crew */}
        {isInCrew && (
          <View style={[theme.components.card, styles.sectionCard]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Crew Missions</Text>
            </View>

            {/* Mission Status Filter */}
            <View style={styles.missionFilter}>
              {(['active', 'completed', 'all'] as const).map((filter) => {
                const isActive = crewMissionFilter === filter;
                const label = filter.charAt(0).toUpperCase() + filter.slice(1);
                return (
                  <Pressable
                    key={filter}
                    style={[styles.filterButton, isActive && styles.filterButtonActive]}
                    onPress={() => setCrewMissionFilter(filter)}
                  >
                    <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Mission Period Selector */}
            <View style={[styles.missionFilter, { marginTop: 8 }]}>
              {(['daily', 'weekly', 'monthly'] as const).map((period) => {
                const isActive = crewMissionPeriod === period;
                const label = period.charAt(0).toUpperCase() + period.slice(1);
                return (
                  <Pressable
                    key={period}
                    style={[styles.filterButton, isActive && styles.filterButtonActive]}
                    onPress={() => setCrewMissionPeriod(period)}
                  >
                    <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {filteredCrewMissions.length === 0 ? (
              <View style={styles.emptyMissions}>
                <Ionicons 
                  name={crewMissionFilter === 'completed' ? "trophy-outline" : "people-outline"} 
                  size={48} 
                  color={crewMissionFilter === 'completed' ? theme.colors.textMuted : theme.colors.primary} 
                />
                <Text style={styles.emptyText}>
                  {crewMissionFilter === 'completed' 
                    ? 'No completed crew missions yet' 
                    : 'All crew missions completed!'}
                </Text>
                {crewMissionFilter === 'completed' && (
                  <Text style={styles.emptySubtext}>Complete active crew missions to see them here</Text>
                )}
              </View>
            ) : (
              filteredCrewMissions.map(renderMission)
            )}
          </View>
        )}

        {/* Achievements */}
        <View style={[theme.components.card, styles.sectionCard]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color={theme.colors.accent} />
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
      paddingTop: theme.screen.isSmallDevice ? theme.spacing.lg : theme.spacing.xl,
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
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
      gap: theme.screen.isSmallDevice ? theme.spacing.md : theme.spacing.lg,
      marginBottom: theme.screen.isSmallDevice ? theme.spacing.md : theme.spacing.lg,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatar: {
      width: theme.screen.isSmallDevice ? 56 : 64,
      height: theme.screen.isSmallDevice ? 56 : 64,
      borderRadius: theme.screen.isSmallDevice ? 28 : 32,
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
      fontSize: theme.screen.isSmallDevice ? 18 : 20,
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
      marginBottom: theme.spacing.lg,
    },
    sectionCard: {
      marginBottom: theme.spacing.lg,
      padding: 0,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    
    // Mission Filter
    missionFilter: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    filterButtonTextActive: {
      color: theme.colors.text,
    },
    emptyMissions: {
      alignItems: 'center',
      padding: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    
    // Mission Cards
    missionCard: {
      backgroundColor: 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      padding: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    missionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    missionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    missionHeaderText: {
      flex: 1,
      gap: 2,
    },
    missionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    missionTime: {
      fontSize: 11,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    missionReward: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.colors.accent + '20',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: 10,
    },
    missionRewardText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.accent,
    },
    missionDescription: {
      fontSize: 13,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
      minWidth: 35,
      textAlign: 'right',
    },
    
    // Achievement Cards
    achievementCard: {
      backgroundColor: 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      padding: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    achievementLocked: {
      opacity: 0.6,
    },
    achievementIcon: {
      fontSize: 28,
    },
    achievementContent: {
      flex: 1,
      gap: 2,
    },
    achievementTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    achievementDescription: {
      fontSize: 12,
      color: theme.colors.textMuted,
      lineHeight: 16,
    },
    achievementPoints: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.accent,
      marginTop: 2,
    },
    achievementProgressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: 6,
    },
    achievementProgressBar: {
      flex: 1,
      height: 4,
      backgroundColor: theme.colors.surface,
      borderRadius: 2,
      overflow: 'hidden',
    },
    achievementProgressFill: {
      height: '100%',
      borderRadius: 2,
    },
    achievementProgressText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
      minWidth: 35,
    },
    textMuted: {
      opacity: 0.7,
    },
    lastItem: {
      borderBottomWidth: 0,
      paddingBottom: theme.spacing.lg,
    },

    // Leaderboard
    rankCard: {
      padding: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rankLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rankBadge: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.pill,
    },
    rankNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    periodSelector: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: theme.spacing.sm,
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
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    periodButtonTextActive: {
      color: theme.colors.text,
    },
    emptyLeaderboard: {
      alignItems: 'center',
      padding: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    emptySubtext: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    leaderboardCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: theme.spacing.md,
    },
    leaderboardRank: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaderboardRankText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    leaderboardInfo: {
      flex: 1,
      gap: 3,
    },
    leaderboardName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    leaderboardStats: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });
