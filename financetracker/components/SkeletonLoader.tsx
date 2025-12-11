import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonLoaderProps) {
  const theme = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.colors.surface,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  style?: ViewStyle;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  const theme = useAppTheme();
  return (
    <View style={[theme.components.card, style]}>
      <SkeletonLoader height={24} width="60%" style={{ marginBottom: 12 }} />
      <SkeletonLoader height={16} width="40%" style={{ marginBottom: 8 }} />
      <SkeletonLoader height={32} width="80%" />
    </View>
  );
}

interface SkeletonListItemProps {
  style?: ViewStyle;
}

export function SkeletonListItem({ style }: SkeletonListItemProps) {
  const theme = useAppTheme();
  return (
    <View style={[styles.listItem, style]}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.listItemContent}>
        <SkeletonLoader height={16} width="70%" style={{ marginBottom: 6 }} />
        <SkeletonLoader height={14} width="40%" />
      </View>
      <SkeletonLoader height={16} width={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  listItemContent: {
    flex: 1,
  },
});
