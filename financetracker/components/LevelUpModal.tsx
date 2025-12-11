/**
 * Level Up Notification Component
 * Shows a celebration modal when user levels up
 */

import { Modal, View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useAppTheme } from '../theme';

interface LevelUpModalProps {
  visible: boolean;
  level: number;
  pointsAwarded?: number;
  reason?: string;
  onClose: () => void;
}

export function LevelUpModal({ visible, level, pointsAwarded, reason, onClose }: LevelUpModalProps) {
  const theme = useAppTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
    }
  }, [visible]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      width: '85%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#FFD70022',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    levelText: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#FFD700',
      marginBottom: 16,
    },
    message: {
      fontSize: 16,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },
    pointsText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 24,
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 120,
    },
    buttonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <Animated.View 
            style={[
              styles.iconContainer,
              { transform: [{ rotate }] }
            ]}
          >
            <Ionicons name="trophy" size={60} color="#FFD700" />
          </Animated.View>

          <Text style={styles.title}>Level Up!</Text>
          <Text style={styles.levelText}>Level {level}</Text>
          
          {reason && (
            <Text style={styles.message}>{reason}</Text>
          )}
          
          {pointsAwarded !== undefined && (
            <Text style={styles.pointsText}>
              +{pointsAwarded} points
            </Text>
          )}

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Awesome! 🎉</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Simple points notification (non-blocking)
 */
export function showPointsNotification(points: number, reason: string) {
  // This would ideally use a toast/snackbar library
  // For now, we'll just log it
  console.log(`🎯 +${points} pts: ${reason}`);
}
