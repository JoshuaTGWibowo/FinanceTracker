import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeMode, useFinanceStore } from "./lib/store";

type Colors = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  surfaceTransparent: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  accentSecondary: string;
  text: string;
  textMuted: string;
  success: string;
  danger: string;
  warning: string;
  border: string;
  glassStroke: string;
  glow: string;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

const darkColors: Colors = {
  background: "#03050A",
  backgroundAlt: "#060910",
  surface: "#0F1421",
  surfaceElevated: "#141B2D",
  surfaceTransparent: "rgba(6, 10, 18, 0.72)",
  primary: "#5C7CFA",
  primaryMuted: "#3D5AFE",
  accent: "#7DD3FC",
  accentSecondary: "#A78BFA",
  text: "#F8FBFF",
  textMuted: "#91A4C7",
  success: "#4ADE80",
  danger: "#FB7185",
  warning: "#FACC15",
  border: "#1E2640",
  glassStroke: "rgba(255,255,255,0.08)",
  glow: "rgba(92,124,250,0.45)",
};

const lightColors: Colors = {
  background: "#F4F7FE",
  backgroundAlt: "#EAF0FF",
  surface: "#FFFFFF",
  surfaceElevated: "#F6F8FF",
  surfaceTransparent: "rgba(255,255,255,0.82)",
  primary: "#2563EB",
  primaryMuted: "#1D4ED8",
  accent: "#60A5FA",
  accentSecondary: "#818CF8",
  text: "#0F172A",
  textMuted: "#4C5973",
  success: "#10B981",
  danger: "#E11D48",
  warning: "#EAB308",
  border: "#CBD5F5",
  glassStroke: "rgba(15,23,42,0.06)",
  glow: "rgba(37,99,235,0.35)",
};

const gradients = {
  dark: {
    hero: ["#1F2B50", "#0C1224"],
    balance: ["#5C7CFA", "#8B5CF6", "#F472B6"],
    chip: ["rgba(92,124,250,0.25)", "rgba(167,139,250,0.12)"],
    tab: ["rgba(10,16,27,0.85)", "rgba(4,6,10,0.9)"],
  },
  light: {
    hero: ["#E0E7FF", "#FDF2FF"],
    balance: ["#2563EB", "#4F46E5", "#C026D3"],
    chip: ["rgba(37,99,235,0.25)", "rgba(16,185,129,0.15)"],
    tab: ["rgba(255,255,255,0.92)", "rgba(232,244,255,0.92)"],
  },
} as const satisfies Record<ThemeMode, Record<string, readonly string[]>>;

const buildTypography = (colors: Colors) => ({
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.2,
    textShadowColor: colors.glow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: colors.text,
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 1.8,
  },
});

const buildComponents = (colors: Colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    shadowColor: colors.background,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassStroke,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonPrimaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  buttonSecondary: {
    borderRadius: radii.md,
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
    borderWidth: 1,
    borderColor: colors.glassStroke,
  },
  glassCard: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    backgroundColor: colors.surfaceTransparent,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    overflow: "hidden" as const,
  },
  glowBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.glow,
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
    gradients: gradients[mode],
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
