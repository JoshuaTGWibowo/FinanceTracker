import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeMode, useFinanceStore } from "./lib/store";
import { useScreenSize, responsiveFontSize, responsiveSpacing } from "./lib/responsive";

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
  background: "#050608",
  surface: "#10121B",
  surfaceElevated: "#161A26",
  primary: "#3B82F6",
  primaryMuted: "#2563EB",
  accent: "#60A5FA",
  text: "#F8FAFF",
  textMuted: "#94A3B8",
  success: "#34D399",
  danger: "#FB7185",
  border: "#1F2937",
};

const lightColors: Colors = {
  background: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceElevated: "#F8FAFC",
  primary: "#2563EB",
  primaryMuted: "#1E40AF",
  accent: "#3B82F6",
  text: "#0F172A",
  textMuted: "#475569",
  success: "#059669",
  danger: "#DC2626",
  border: "#CBD5E1",
};

const oceanColors: Colors = {
  background: "#0A1628",
  surface: "#0F1F3D",
  surfaceElevated: "#1A2F4F",
  primary: "#06B6D4",
  primaryMuted: "#0891B2",
  accent: "#22D3EE",
  text: "#F0F9FF",
  textMuted: "#93C5FD",
  success: "#34D399",
  danger: "#FB7185",
  border: "#1E3A5F",
};

const sunsetColors: Colors = {
  background: "#1A0B1E",
  surface: "#2D1B3D",
  surfaceElevated: "#3D2652",
  primary: "#F472B6",
  primaryMuted: "#EC4899",
  accent: "#FBCFE8",
  text: "#FDF4FF",
  textMuted: "#E9D5FF",
  success: "#A78BFA",
  danger: "#FB923C",
  border: "#4C1D95",
};

const forestColors: Colors = {
  background: "#0C1410",
  surface: "#1A2920",
  surfaceElevated: "#233B30",
  primary: "#10B981",
  primaryMuted: "#059669",
  accent: "#34D399",
  text: "#F0FDF4",
  textMuted: "#86EFAC",
  success: "#4ADE80",
  danger: "#FCA5A5",
  border: "#1F3B2E",
};

const lavenderColors: Colors = {
  background: "#1C1525",
  surface: "#2A1F3D",
  surfaceElevated: "#3D2A5A",
  primary: "#A78BFA",
  primaryMuted: "#8B5CF6",
  accent: "#C4B5FD",
  text: "#FAF5FF",
  textMuted: "#DDD6FE",
  success: "#34D399",
  danger: "#F472B6",
  border: "#4C1D95",
};

const midnightColors: Colors = {
  background: "#0A0E27",
  surface: "#151B3E",
  surfaceElevated: "#1F2850",
  primary: "#818CF8",
  primaryMuted: "#6366F1",
  accent: "#A5B4FC",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  success: "#22D3EE",
  danger: "#FB7185",
  border: "#1E3A8A",
};

const coralColors: Colors = {
  background: "#1A0F0A",
  surface: "#2D1B14",
  surfaceElevated: "#442820",
  primary: "#FB923C",
  primaryMuted: "#F97316",
  accent: "#FDBA74",
  text: "#FFF7ED",
  textMuted: "#FED7AA",
  success: "#4ADE80",
  danger: "#EF4444",
  border: "#7C2D12",
};

const arcticColors: Colors = {
  background: "#0C1821",
  surface: "#162838",
  surfaceElevated: "#1F3A52",
  primary: "#67E8F9",
  primaryMuted: "#06B6D4",
  accent: "#A5F3FC",
  text: "#ECFEFF",
  textMuted: "#99F6E4",
  success: "#6EE7B7",
  danger: "#FCA5A5",
  border: "#164E63",
};

const autumnColors: Colors = {
  background: "#1C1410",
  surface: "#2D221A",
  surfaceElevated: "#443226",
  primary: "#FBBF24",
  primaryMuted: "#F59E0B",
  accent: "#FCD34D",
  text: "#FFFBEB",
  textMuted: "#FDE68A",
  success: "#84CC16",
  danger: "#F87171",
  border: "#78350F",
};

const crimsonColors: Colors = {
  background: "#0A0404",
  surface: "#1A0909",
  surfaceElevated: "#2D1212",
  primary: "#DC2626",
  primaryMuted: "#B91C1C",
  accent: "#EF4444",
  text: "#FEF2F2",
  textMuted: "#FCA5A5",
  success: "#22C55E",
  danger: "#F87171",
  border: "#7F1D1D",
};

const pastelColors: Colors = {
  background: "#FAF5FF",
  surface: "#FFFFFF",
  surfaceElevated: "#F3E8FF",
  primary: "#D946EF",
  primaryMuted: "#C026D3",
  accent: "#E879F9",
  text: "#3B0764",
  textMuted: "#86198F",
  success: "#4ADE80",
  danger: "#FB7185",
  border: "#F5D0FE",
};

const mintColors: Colors = {
  background: "#ECFDF5",
  surface: "#FFFFFF",
  surfaceElevated: "#D1FAE5",
  primary: "#10B981",
  primaryMuted: "#059669",
  accent: "#34D399",
  text: "#064E3B",
  textMuted: "#047857",
  success: "#22C55E",
  danger: "#EF4444",
  border: "#A7F3D0",
};

const roseColors: Colors = {
  background: "#FFF1F2",
  surface: "#FFFFFF",
  surfaceElevated: "#FFE4E6",
  primary: "#F43F5E",
  primaryMuted: "#E11D48",
  accent: "#FB7185",
  text: "#4C0519",
  textMuted: "#881337",
  success: "#10B981",
  danger: "#DC2626",
  border: "#FECDD3",
};

const slateColors: Colors = {
  background: "#0F172A",
  surface: "#1E293B",
  surfaceElevated: "#334155",
  primary: "#64748B",
  primaryMuted: "#475569",
  accent: "#94A3B8",
  text: "#F1F5F9",
  textMuted: "#CBD5E1",
  success: "#22D3EE",
  danger: "#F87171",
  border: "#475569",
};

const buildTypography = (colors: Colors, screen: ReturnType<typeof useScreenSize>) => ({
  title: {
    fontSize: responsiveFontSize(screen.isSmallDevice ? 24 : 28),
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: "500" as const,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: responsiveFontSize(15),
    fontWeight: "400" as const,
    color: colors.text,
    lineHeight: 22,
  },
  label: {
    fontSize: responsiveFontSize(12),
    fontWeight: "600" as const,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: screen.isSmallDevice ? 1.2 : 1.8,
  },
});

const buildComponents = (colors: Colors, screen: ReturnType<typeof useScreenSize>) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: responsiveSpacing(screen.isSmallDevice ? 16 : spacing.xl),
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: responsiveSpacing(screen.isSmallDevice ? 12 : spacing.lg),
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
  inputSurface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
});

const buildTheme = (mode: ThemeMode, screen: ReturnType<typeof useScreenSize>) => {
  let colors: Colors;
  switch (mode) {
    case "light":
      colors = lightColors;
      break;
    case "ocean":
      colors = oceanColors;
      break;
    case "sunset":
      colors = sunsetColors;
      break;
    case "forest":
      colors = forestColors;
      break;
    case "lavender":
      colors = lavenderColors;
      break;
    case "midnight":
      colors = midnightColors;
      break;
    case "coral":
      colors = coralColors;
      break;
    case "arctic":
      colors = arcticColors;
      break;
    case "autumn":
      colors = autumnColors;
      break;
    case "crimson":
      colors = crimsonColors;
      break;
    case "pastel":
      colors = pastelColors;
      break;
    case "mint":
      colors = mintColors;
      break;
    case "rose":
      colors = roseColors;
      break;
    case "slate":
      colors = slateColors;
      break;
    case "dark":
    default:
      colors = darkColors;
      break;
  }
  return {
    colors,
    spacing,
    radii,
    typography: buildTypography(colors, screen),
    components: buildComponents(colors, screen),
    screen,
  };
};

export type Theme = ReturnType<typeof buildTheme>;

export const useAppTheme = (): Theme => {
  const mode = useFinanceStore((state) => state.preferences.themeMode);
  const screen = useScreenSize();
  return useMemo(() => buildTheme(mode, screen), [mode, screen.width, screen.height]);
};

export const useThemedStyles = <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: Theme) => T,
): T => {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
};

export const getThemeForMode = (mode: ThemeMode, screen: ReturnType<typeof useScreenSize>): Theme => buildTheme(mode, screen);
