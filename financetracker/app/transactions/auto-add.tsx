/**
 * Auto Add Capture Screen
 * 
 * Allows users to take a photo or select from gallery to automatically
 * extract transaction data using AI.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { useAppTheme } from '../../theme';
import { parseReceiptImage } from '../../lib/ai-receipt-parser';
import { matchCategoriesForTransactions } from '../../lib/category-matcher';
import { checkForDuplicates } from '../../lib/duplicate-detection';
import { useFinanceStore } from '../../lib/store';
import ImageCropper from '../../components/ImageCropper';

type ProcessingState = 'idle' | 'capturing' | 'cropping' | 'processing' | 'error';

interface PendingImage {
  uri: string;
  width: number;
  height: number;
}

export default function AutoAddScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.preferences.categories);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const handleTakePhoto = useCallback(async () => {
    try {
      setProcessingState('capturing');
      setErrorMessage(null);

      // Request camera permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take photos of receipts.',
          [{ text: 'OK' }]
        );
        setProcessingState('idle');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        // expo-image-picker v15 uses array format at runtime
        mediaTypes: ['images'] as unknown as ImagePicker.MediaTypeOptions,
        // Don't use built-in editing - we'll use our own cropper for freeform cropping
        allowsEditing: false,
        quality: 0.8,
        base64: false, // We'll get base64 after cropping
      });

      if (result.canceled || !result.assets?.[0]) {
        setProcessingState('idle');
        return;
      }

      const asset = result.assets[0];
      // Show cropper
      setPendingImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setProcessingState('cropping');
    } catch (error) {
      console.error('[AutoAdd] Camera error:', error);
      setProcessingState('error');
      setErrorMessage('Failed to capture photo. Please try again.');
    }
  }, []);

  const handleChooseFromGallery = useCallback(async () => {
    try {
      setProcessingState('capturing');
      setErrorMessage(null);

      // Request media library permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Gallery Permission Required',
          'Please allow access to your photo library to select images.',
          [{ text: 'OK' }]
        );
        setProcessingState('idle');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // expo-image-picker v15 uses array format at runtime
        mediaTypes: ['images'] as unknown as ImagePicker.MediaTypeOptions,
        // Don't use built-in editing - we'll use our own cropper for freeform cropping
        allowsEditing: false,
        quality: 0.8,
        base64: false, // We'll get base64 after cropping
      });

      if (result.canceled || !result.assets?.[0]) {
        setProcessingState('idle');
        return;
      }

      const asset = result.assets[0];
      // Show cropper
      setPendingImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setProcessingState('cropping');
    } catch (error) {
      console.error('[AutoAdd] Gallery error:', error);
      setProcessingState('error');
      setErrorMessage('Failed to select image. Please try again.');
    }
  }, []);

  const processImage = useCallback(async (base64: string, mimeType: string, previewUri?: string) => {
    setProcessingState('processing');
    setErrorMessage(null);
    if (previewUri) {
      setImageUri(previewUri);
    }

    try {
      const result = await parseReceiptImage(base64, mimeType);

      if (!result.success) {
        setProcessingState('error');
        setErrorMessage(result.error || 'Failed to analyze image');
        return;
      }

      if (result.transactions.length === 0) {
        setProcessingState('error');
        setErrorMessage('No transactions detected in this image.\n\nTips:\n• Make sure the receipt or statement is clearly visible\n• Ensure good lighting without glare\n• The total amount should be readable\n• Try cropping to focus on the transaction details');
        return;
      }

      // Match categories to user's categories
      const matchedTransactions = matchCategoriesForTransactions(
        result.transactions,
        categories
      );

      // Check for duplicates
      const duplicateCheck = checkForDuplicates(
        result.transactions,
        transactions
      );

      // Navigate to review screen with data
      router.push({
        pathname: '/transactions/auto-add-review' as const,
        params: {
          transactions: JSON.stringify(matchedTransactions),
          duplicates: JSON.stringify(duplicateCheck),
          imageUri: previewUri || '',
        },
      } as never);

      setProcessingState('idle');
    } catch (error) {
      console.error('[AutoAdd] Processing error:', error);
      setProcessingState('error');
      setErrorMessage('Failed to process image. Please try again.');
    }
  }, [categories, transactions, router]);

  const handleRetry = useCallback(() => {
    setImageUri(null);
    setPendingImage(null);
    setProcessingState('idle');
    setErrorMessage(null);
  }, []);

  const handleCropComplete = useCallback(async (croppedBase64: string, mimeType: string, resultUri: string) => {
    setPendingImage(null);
    // Use the actual cropped image URI for preview
    await processImage(croppedBase64, mimeType, resultUri);
  }, [processImage]);

  const handleCropCancel = useCallback(() => {
    setPendingImage(null);
    setProcessingState('idle');
  }, []);

  const isProcessing = processingState === 'processing' || processingState === 'capturing';

  // Show cropper if we have a pending image
  if (processingState === 'cropping' && pendingImage) {
    return (
      <ImageCropper
        imageUri={pendingImage.uri}
        imageWidth={pendingImage.width}
        imageHeight={pendingImage.height}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Auto Add</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Ionicons name="sparkles" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Scan Receipt or Statement</Text>
          <Text style={styles.heroDescription}>
            Take a photo or choose an image of a receipt, invoice, or bank statement. 
            AI will automatically extract the transaction details.
          </Text>
        </View>

        {/* Image Preview */}
        {imageUri && (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              contentFit="contain"
            />
            {isProcessing && (
              <View style={styles.previewOverlay}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.processingText}>
                  {processingState === 'capturing' ? 'Loading...' : 'Analyzing image...'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Ionicons 
              name={errorMessage.includes('No transactions') ? 'document-text-outline' : 'warning'} 
              size={32} 
              color={errorMessage.includes('No transactions') ? theme.colors.textMuted : theme.colors.danger} 
            />
            <Text style={[
              styles.errorText,
              errorMessage.includes('No transactions') && { color: theme.colors.text }
            ]}>
              {errorMessage}
            </Text>
            <Pressable onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Action Buttons */}
        {!isProcessing && processingState !== 'error' && (
          <View style={styles.actionsContainer}>
            <Pressable
              style={styles.actionButton}
              onPress={handleTakePhoto}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons name="camera" size={32} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionTitle}>Take Photo</Text>
              <Text style={styles.actionDescription}>
                Capture a receipt or statement
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={handleChooseFromGallery}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${theme.colors.accent}20` }]}>
                <Ionicons name="images" size={32} color={theme.colors.accent} />
              </View>
              <Text style={styles.actionTitle}>Choose from Gallery</Text>
              <Text style={styles.actionDescription}>
                Select an existing image
              </Text>
            </Pressable>
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips for best results</Text>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.tipText}>Ensure good lighting and focus</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.tipText}>Include the total amount clearly</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.tipText}>For statements, capture all transactions</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.tipText}>Avoid glare and shadows</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl + 96 + insets.bottom,
      gap: theme.screen.isSmallDevice ? theme.spacing.md : theme.spacing.lg,
    },
    heroSection: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
    },
    heroIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `${theme.colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    heroDescription: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: theme.spacing.md,
    },
    previewContainer: {
      borderRadius: theme.radii.lg,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    previewImage: {
      width: '100%',
      height: 250,
    },
    previewOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
    },
    processingText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    errorContainer: {
      backgroundColor: `${theme.colors.danger}15`,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: `${theme.colors.danger}30`,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.danger,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryButton: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.danger,
      borderRadius: theme.radii.pill,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    actionsContainer: {
      gap: theme.spacing.md,
    },
    actionButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    actionIconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xs,
    },
    actionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    actionDescription: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    tipsContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tipsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    tipText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      flex: 1,
    },
  });
