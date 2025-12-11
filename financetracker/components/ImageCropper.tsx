/**
 * ImageCropper Component (Simplified)
 * 
 * A simple image cropping component that allows users to skip cropping
 * or use the full image. For complex cropping, we rely on the native
 * image picker's built-in cropping on platforms that support it.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, Theme } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;

interface ImageCropperProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCropComplete: (croppedBase64: string, mimeType: string, resultUri: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({
  imageUri,
  imageWidth,
  imageHeight,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate display dimensions to fit in screen
  const maxDisplayWidth = SCREEN_WIDTH - CONTAINER_PADDING * 2;
  const maxDisplayHeight = 450;
  
  const scale = Math.min(
    maxDisplayWidth / imageWidth,
    maxDisplayHeight / imageHeight
  );
  
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;

  const handleContinue = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      // Process the full image without cropping
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );

      if (result.base64) {
        onCropComplete(result.base64, 'image/jpeg', result.uri);
      }
    } catch (error) {
      console.error('[ImageCropper] Error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, onCropComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Preview Image</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          Review the image before scanning
        </Text>
      </View>

      <View style={styles.imageWrapper}>
        <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: displayWidth, height: displayHeight }}
            contentFit="contain"
          />
        </View>
      </View>

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Tips for best results:</Text>
        <Text style={styles.tipText}>• Ensure the receipt/statement is clearly visible</Text>
        <Text style={styles.tipText}>• Good lighting without glare works best</Text>
        <Text style={styles.tipText}>• Make sure amounts are readable</Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.retakeButton}
          onPress={onCancel}
          disabled={isProcessing}
        >
          <Ionicons name="camera-reverse" size={20} color={theme.colors.primary} />
          <Text style={styles.retakeButtonText}>Retake</Text>
        </Pressable>
        
        <Pressable
          style={[styles.continueButton, isProcessing && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.continueButtonText}>Scan Image</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerButton: {
      padding: 8,
    },
    headerSpacer: {
      width: 40,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    instructions: {
      padding: 12,
      alignItems: 'center',
    },
    instructionsText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    imageWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: CONTAINER_PADDING,
    },
    imageContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    tipsContainer: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    tipsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    tipText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    footer: {
      flexDirection: 'row',
      padding: 20,
      paddingBottom: 40,
      gap: 12,
    },
    retakeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.card,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    retakeButtonText: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    continueButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    continueButtonDisabled: {
      opacity: 0.7,
    },
    continueButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
