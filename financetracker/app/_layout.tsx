import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAppTheme } from "../theme";
import { ThemeMode, useFinanceStore } from "../lib/store";

export default function RootLayout() {
  const theme = useAppTheme();
  const themeMode = useFinanceStore(
    (state) => (state?.preferences?.themeMode ?? "dark") as ThemeMode,
  );
  const statusBarStyle = themeMode === "light" ? "dark" : "light";

  useEffect(() => {
    const state = useFinanceStore.getState();
    state.ensureDefaultCategories();

    const unsubscribe = useFinanceStore.subscribe(
      (current) => current.preferences.categories.length,
      (length) => {
        if (length === 0) {
          useFinanceStore.getState().ensureDefaultCategories();
        }
      },
    );

    return unsubscribe;
  }, []);

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
          name="transactions/new"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </>
  );
}
