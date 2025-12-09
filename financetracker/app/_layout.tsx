import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState } from "react-native";

import { useAppTheme } from "../theme";
import { useFinanceStore } from "../lib/store";
import { startAutoSync, stopAutoSync } from "../lib/sync-service";
import { LevelUpModal } from "../components/LevelUpModal";
import { updateDailyStreak } from "../lib/points-service";
import { refreshExpiredMissions, initializeMissions } from "../lib/mission-refresh";

export default function RootLayout() {
  const theme = useAppTheme();
  const themeMode = useFinanceStore((state) => state.preferences.themeMode);
  const hydrateFromDatabase = useFinanceStore((state) => state.hydrateFromDatabase);
  const isHydrated = useFinanceStore((state) => state.isHydrated);
  const transactions = useFinanceStore((state) => state.transactions);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const statusBarStyle = themeMode === "light" ? "dark" : "light";

  // Level-up modal state
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ level: 1, points: 0, reason: '' });

  useEffect(() => {
    hydrateFromDatabase();
  }, [hydrateFromDatabase]);

  // Update daily streak and refresh missions on app launch
  useEffect(() => {
    if (!isHydrated) return;
    
    const profile = useFinanceStore.getState().profile;
    const userTimezone = profile.timezone || 'Australia/Melbourne';
    
    // Update streak
    updateDailyStreak().then((result) => {
      if (result.success && result.pointsAwarded && result.pointsAwarded > 0) {
        console.log(`[Streak] 🔥 ${result.streakDays} day streak! +${result.pointsAwarded} pts`);
      }
    }).catch(err => console.error('[Streak] Error:', err));

    // Initialize missions if none exist
    initializeMissions(userTimezone).then((result) => {
      if (result.success) {
        // Then refresh expired missions
        refreshExpiredMissions(userTimezone).then((refreshResult) => {
          if (refreshResult.success && refreshResult.refreshedCount && refreshResult.refreshedCount > 0) {
            console.log(`[Missions] 🔄 Refreshed ${refreshResult.refreshedCount} expired mission(s)`);
          }
        }).catch(err => console.error('[Missions] Refresh error:', err));
      }
    }).catch(err => console.error('[Missions] Init error:', err));
  }, [isHydrated]);

  // Start auto-sync when app loads
  useEffect(() => {
    if (!isHydrated) return;

    // Start auto-sync with current data
    startAutoSync(
      () => useFinanceStore.getState().transactions,
      () => useFinanceStore.getState().budgetGoals
    );

    // Handle app state changes (pause sync when app is in background)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Resume syncing when app comes to foreground
        startAutoSync(
          () => useFinanceStore.getState().transactions,
          () => useFinanceStore.getState().budgetGoals
        );
      } else {
        // Stop syncing when app goes to background
        stopAutoSync();
      }
    });

    // Cleanup on unmount
    return () => {
      stopAutoSync();
      subscription.remove();
    };
  }, [isHydrated]);

  if (!isHydrated) {
    return <StatusBar style={statusBarStyle} />;
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="categories/index"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="categories/new"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="categories/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="categories/select-icon"
          options={{
            headerShown: false,
            animation: "fade",
          }}
        />
        <Stack.Screen
          name="categories/select-parent"
          options={{
            headerShown: false,
            animation: "fade",
          }}
        />
        <Stack.Screen
          name="accounts/index"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/new"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="transactions/net-income-details"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/category-details"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/category-report"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/net-income-week"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/report"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
      
      <LevelUpModal
        visible={levelUpVisible}
        level={levelUpData.level}
        pointsAwarded={levelUpData.points}
        reason={levelUpData.reason}
        onClose={() => setLevelUpVisible(false)}
      />
    </>
  );
}
