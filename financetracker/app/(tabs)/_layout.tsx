import { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { useAppTheme } from "../../theme";

function AddTransactionTabButton({ style, ...props }: BottomTabBarButtonProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      {...props}
      onPress={(event) => {
        event.preventDefault();
        router.push("/transactions/new");
      }}
      style={({ pressed }) => [style, styles.addButtonWrapper, pressed && styles.addButtonWrapperPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
    >
      <View style={styles.addButtonIconWrapper}>
        <Ionicons name="add" size={22} color={theme.colors.background} />
      </View>
      <Text style={styles.addButtonLabel}>Add</Text>
    </Pressable>
  );
}

interface AnimatedTabIconProps {
  focused: boolean;
  color: string;
  size: number;
  activeName: keyof typeof Ionicons.glyphMap;
  inactiveName: keyof typeof Ionicons.glyphMap;
}

function AnimatedTabIcon({ focused, color, size, activeName, inactiveName }: AnimatedTabIconProps) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0.9,
      useNativeDriver: true,
      damping: 12,
      stiffness: 150,
    }).start();
    Animated.timing(opacity, {
      toValue: focused ? 1 : 0.6,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [focused, opacity, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <Ionicons name={focused ? activeName : inactiveName} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
              color={color}
              size={size}
              focused={focused}
              activeName="sparkles"
              inactiveName="sparkles-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
              color={color}
              size={size}
              focused={focused}
              activeName="list"
              inactiveName="list-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add-transaction"
        options={{
          title: "Add",
          href: undefined,
          tabBarButton: (props) => <AddTransactionTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
              color={color}
              size={size}
              focused={focused}
              activeName="podium"
              inactiveName="podium-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
              color={color}
              size={size}
              focused={focused}
              activeName="person"
              inactiveName="person-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      height: Platform.select({ ios: 72, default: 60 }),
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: Platform.select({ ios: 16, default: 10 }),
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
    addButtonWrapper: {
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    addButtonWrapperPressed: {
      opacity: 0.8,
    },
    addButtonIconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.success,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.colors.success,
      shadowOpacity: Platform.OS === "ios" ? 0.35 : 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    addButtonLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textMuted,
      letterSpacing: 0.4,
    },
  });
