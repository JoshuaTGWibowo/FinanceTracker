import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeMode, useFinanceStore } from "./lib/store";

type Colors = {
  background: string;
  backgroundMuted: string;
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
  outline: string;
  glow: string;
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
  background: "#030614",
  backgroundMuted: "#050B1F",
  surface: "#0D1324",
  surfaceElevated: "#151C33",
  primary: "#7C5CFF",
  primaryMuted: "#6241FF",
  accent: "#22D3EE",
  text: "#F5F7FF",
  textMuted: "#94A3B8",
  success: "#22C55E",
  danger: "#FB7185",
  border: "#1F2A40",
  outline: "rgba(255,255,255,0.06)",
  glow: "rgba(124,92,255,0.4)",
};

const lightColors: Colors = {
  background: "#F5F7FF",
  backgroundMuted: "#EEF2FF",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF2FF",
  primary: "#5B21FF",
  primaryMuted: "#4338CA",
  accent: "#0EA5E9",
  text: "#0F172A",
  textMuted: "#475569",
  success: "#16A34A",
  danger: "#B91C1C",
  border: "#CBD5F5",
  outline: "rgba(15,23,42,0.08)",
  glow: "rgba(91,33,255,0.14)",
};

const buildTypography = (colors: Colors) => ({
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.2,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    shadowColor: colors.glow,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
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
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.outline,
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
    borderColor: colors.outline,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.outline,
  },
});

const buildGradients = (mode: ThemeMode) => {
  if (mode === "light") {
    return {
      hero: ["#EEF2FF", "#FFFFFF"],
      highlight: ["rgba(91,33,255,0.12)", "rgba(14,165,233,0.12)"],
      action: ["#5B21FF", "#2563EB"],
    } as const;
  }

  return {
    hero: ["#090B1F", "#04030D"],
    highlight: ["rgba(124,92,255,0.2)", "rgba(34,211,238,0.08)"],
    action: ["#A855F7", "#6366F1"],
  } as const;
};

const buildTheme = (mode: ThemeMode) => {
  const colors = mode === "light" ? lightColors : darkColors;
  return {
    colors,
    spacing,
    radii,
    typography: buildTypography(colors),
    components: buildComponents(colors),
    gradients: buildGradients(mode),
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
