import { ReactNode, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  size?: "sm" | "md" | "lg";
  renderIcon?: (option: SegmentedControlOption<T>, active: boolean) => ReactNode;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  renderIcon,
}: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, size === "lg" && styles.containerLarge]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              size === "sm" && styles.segmentSmall,
              size === "lg" && styles.segmentLarge,
              pressed && !active && styles.segmentPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {renderIcon ? (
              <View style={styles.iconWrapper}>{renderIcon(option, active)}</View>
            ) : null}
            <View style={styles.copy}>
              <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
              {option.hint ? (
                <Text style={[styles.hint, active && styles.hintActive]}>{option.hint}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: `${theme.colors.surface}AA`,
      padding: 4,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: `${theme.colors.border}88`,
      gap: 4,
    },
    containerLarge: {
      padding: 6,
      gap: 6,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: "transparent",
      gap: theme.spacing.xs,
    },
    segmentLarge: {
      paddingVertical: theme.spacing.md,
    },
    segmentSmall: {
      paddingVertical: theme.spacing.xs,
    },
    segmentActive: {
      backgroundColor: theme.colors.surfaceElevated,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.15,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    segmentPressed: {
      opacity: 0.6,
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.2,
      color: theme.colors.textMuted,
    },
    labelActive: {
      color: theme.colors.text,
    },
    hint: {
      fontSize: 10,
      fontWeight: "500",
      color: `${theme.colors.textMuted}CC`,
    },
    hintActive: {
      color: theme.colors.primary,
    },
    iconWrapper: {
      marginRight: theme.spacing.xs,
    },
    copy: {
      alignItems: "center",
      justifyContent: "center",
    },
  });
