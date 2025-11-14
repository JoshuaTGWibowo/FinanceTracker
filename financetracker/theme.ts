import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeMode, useFinanceStore } from "./lib/store";

type Colors = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  frosted: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  secondary: string;
  text: string;
  textMuted: string;
  success: string;
  danger: string;
  border: string;
  chartGrid: string;
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
  background: "#050710",
  backgroundAlt: "#080B18",
  surface: "#101426",
  surfaceElevated: "#161B2F",
  frosted: "rgba(13,18,35,0.7)",
  primary: "#8B5CF6",
  primaryMuted: "#6D28D9",
  accent: "#22D3EE",
  secondary: "#F472B6",
  text: "#F8FAFF",
  textMuted: "#A5B4FC",
  success: "#34D399",
  danger: "#FB7185",
  border: "#1E253F",
  chartGrid: "rgba(148,163,184,0.18)",
};

const lightColors: Colors = {
  background: "#F3F5FF",
  backgroundAlt: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF2FF",
  frosted: "rgba(255,255,255,0.8)",
  primary: "#4C1D95",
  primaryMuted: "#6D28D9",
  accent: "#0EA5E9",
  secondary: "#EC4899",
  text: "#0F172A",
  textMuted: "#475569",
  success: "#047857",
  danger: "#B91C1C",
  border: "#CBD5F5",
  chartGrid: "rgba(15,23,42,0.16)",
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
  },
  cardElevated: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frosted: {
    backgroundColor: colors.frosted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.lg,
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
