import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeMode, useFinanceStore } from "./lib/store";

type Colors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  text: string;
  textMuted: string;
  success: string;
  danger: string;
  border: string;
  overlay: string;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

const darkColors: Colors = {
  background: "#04050A",
  surface: "#0B1020",
  surfaceElevated: "#151B30",
  primary: "#A855F7",
  primaryMuted: "#7C3AED",
  accent: "#38BDF8",
  text: "#F4F6FF",
  textMuted: "#8B9BB7",
  success: "#4ADE80",
  danger: "#FB7185",
  border: "#202840",
  overlay: "rgba(15,20,40,0.7)",
};

const lightColors: Colors = {
  background: "#F5F7FF",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF2FF",
  primary: "#6D28D9",
  primaryMuted: "#5B21B6",
  accent: "#0EA5E9",
  text: "#0F172A",
  textMuted: "#4B5563",
  success: "#059669",
  danger: "#DC2626",
  border: "#E2E8F0",
  overlay: "rgba(255,255,255,0.8)",
};

const buildTypography = (colors: Colors) => ({
  title: {
    fontSize: 30,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    color: colors.text,
    lineHeight: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
  },
});

const buildComponents = (colors: Colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  glassCard: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.overlay,
    backgroundColor: colors.overlay,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonPrimaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  buttonSecondary: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
});

const buildEffects = (mode: ThemeMode, colors: Colors) => ({
  heroGradient:
    mode === "light"
      ? ["#8B5CF6", "#7C3AED", "#2563EB"]
      : ["#312E81", "#4338CA", "#7C3AED"],
  ambientGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
});

const buildTheme = (mode: ThemeMode) => {
  const colors = mode === "light" ? lightColors : darkColors;
  return {
    colors,
    spacing,
    radii,
    typography: buildTypography(colors),
    components: buildComponents(colors),
    effects: buildEffects(mode, colors),
  } as const;
};

const themeMap = {
  light: buildTheme("light"),
  dark: buildTheme("dark"),
} as const satisfies Record<ThemeMode, ReturnType<typeof buildTheme>>;

export type Theme = (typeof themeMap)[keyof typeof themeMap];

export const useAppTheme = (): Theme => {
  const mode = useFinanceStore((state) => state.preferences.themeMode);
  return useMemo(() => themeMap[mode], [mode]);
};

export const useThemedStyles = <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: Theme) => T,
): T => {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
};

export const getThemeForMode = (mode: ThemeMode): Theme => themeMap[mode];
