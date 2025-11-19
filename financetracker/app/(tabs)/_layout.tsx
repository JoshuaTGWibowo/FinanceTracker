import { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "../../theme";

function AddTransactionTabButton({ style, ...props }: BottomTabBarButtonProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

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
      <Animated.View
        pointerEvents="none"
        style={[styles.addButtonHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
      />
      <LinearGradient
        colors={[theme.colors.success, theme.colors.accentSecondary]}
        style={styles.addButtonIconWrapper}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="add" size={22} color={theme.colors.background} />
      </LinearGradient>
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
      <View
        style={{
          padding: 6,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: focused ? `${color}1A` : "transparent",
        }}
      >
        {focused ? (
          <LinearGradient
            colors={[`${color}66`, `${color}00`]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ) : null}
        <Ionicons name={focused ? activeName : inactiveName} size={size} color={color} />
      </View>
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
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => (
          <LinearGradient
            colors={theme.gradients.tab}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ),
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
      position: "absolute",
      left: 12,
      right: 12,
      bottom: Platform.select({ ios: 26, default: 18 }),
      alignSelf: "center",
      backgroundColor: theme.colors.surfaceTransparent,
      borderTopWidth: 0,
      borderRadius: theme.radii.lg + 6,
      borderWidth: 1,
      borderColor: theme.colors.glassStroke,
      elevation: 12,
      shadowColor: theme.colors.background,
      shadowOpacity: Platform.OS === "ios" ? 0.18 : 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      height: Platform.select({ ios: 70, default: 66 }),
      paddingHorizontal: 4,
      paddingTop: 6,
      paddingBottom: Platform.select({ ios: 16, default: 10 }),
      overflow: "hidden",
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.2,
      marginBottom: 0,
      marginTop: 2,
      color: theme.colors.textMuted,
    },
    tabItem: {
      flex: 1,
      flexBasis: 0,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 0,
      paddingVertical: 0,
      paddingHorizontal: 2,
      minWidth: 0,
    },
    addButtonWrapper: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      flex: 1,
      minWidth: 0,
      position: "relative",
    },
    addButtonWrapperPressed: {
      opacity: 0.8,
    },
    addButtonIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.colors.success,
      shadowOpacity: Platform.OS === "ios" ? 0.35 : 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: `${theme.colors.success}66`,
    },
    addButtonHalo: {
      position: "absolute",
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.success,
      opacity: 0.4,
    },
    addButtonLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.colors.text,
      letterSpacing: 0.2,
    },
  });