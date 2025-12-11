/**
 * ImageCropper Component
 * 
 * A freeform image cropping component that allows users to crop images
 * by dragging corners/edges of a crop box.
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme, Theme } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const MIN_CROP_SIZE = 50;

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
  const maxDisplayHeight = 400;
  
  const scale = Math.min(
    maxDisplayWidth / imageWidth,
    maxDisplayHeight / imageHeight
  );
  
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;

  // Crop box state (in display coordinates)
  const cropLeft = useSharedValue(displayWidth * 0.1);
  const cropTop = useSharedValue(displayHeight * 0.1);
  const cropWidth = useSharedValue(displayWidth * 0.8);
  const cropHeight = useSharedValue(displayHeight * 0.8);

  // For tracking which handle is being dragged
  const activeHandle = useSharedValue<string | null>(null);
  const startValues = useSharedValue({ left: 0, top: 0, width: 0, height: 0 });

  const clamp = (value: number, min: number, max: number) => {
    'worklet';
    return Math.min(Math.max(value, min), max);
  };

  // Gesture for dragging the entire crop box
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startValues.value = {
        left: cropLeft.value,
        top: cropTop.value,
        width: cropWidth.value,
        height: cropHeight.value,
      };
    })
    .onUpdate((event) => {
      const newLeft = clamp(
        startValues.value.left + event.translationX,
        0,
        displayWidth - cropWidth.value
      );
      const newTop = clamp(
        startValues.value.top + event.translationY,
        0,
        displayHeight - cropHeight.value
      );
      cropLeft.value = newLeft;
      cropTop.value = newTop;
    });

  // Create handle gesture for resizing
  const createHandleGesture = (handle: string) => {
    return Gesture.Pan()
      .onBegin(() => {
        activeHandle.value = handle;
        startValues.value = {
          left: cropLeft.value,
          top: cropTop.value,
          width: cropWidth.value,
          height: cropHeight.value,
        };
      })
      .onUpdate((event) => {
        const { left, top, width, height } = startValues.value;
        
        switch (handle) {
          case 'tl': // Top-left
            {
              const newLeft = clamp(left + event.translationX, 0, left + width - MIN_CROP_SIZE);
              const newTop = clamp(top + event.translationY, 0, top + height - MIN_CROP_SIZE);
              cropLeft.value = newLeft;
              cropTop.value = newTop;
              cropWidth.value = width - (newLeft - left);
              cropHeight.value = height - (newTop - top);
            }
            break;
          case 'tr': // Top-right
            {
              const newWidth = clamp(width + event.translationX, MIN_CROP_SIZE, displayWidth - left);
              const newTop = clamp(top + event.translationY, 0, top + height - MIN_CROP_SIZE);
              cropWidth.value = newWidth;
              cropTop.value = newTop;
              cropHeight.value = height - (newTop - top);
            }
            break;
          case 'bl': // Bottom-left
            {
              const newLeft = clamp(left + event.translationX, 0, left + width - MIN_CROP_SIZE);
              const newHeight = clamp(height + event.translationY, MIN_CROP_SIZE, displayHeight - top);
              cropLeft.value = newLeft;
              cropWidth.value = width - (newLeft - left);
              cropHeight.value = newHeight;
            }
            break;
          case 'br': // Bottom-right
            {
              const newWidth = clamp(width + event.translationX, MIN_CROP_SIZE, displayWidth - left);
              const newHeight = clamp(height + event.translationY, MIN_CROP_SIZE, displayHeight - top);
              cropWidth.value = newWidth;
              cropHeight.value = newHeight;
            }
            break;
        }
      })
      .onEnd(() => {
        activeHandle.value = null;
      });
  };

  const tlGesture = createHandleGesture('tl');
  const trGesture = createHandleGesture('tr');
  const blGesture = createHandleGesture('bl');
  const brGesture = createHandleGesture('br');

  // Animated styles
  const cropBoxStyle = useAnimatedStyle(() => ({
    left: cropLeft.value,
    top: cropTop.value,
    width: cropWidth.value,
    height: cropHeight.value,
  }));

  const overlayTopStyle = useAnimatedStyle(() => ({
    height: cropTop.value,
    left: 0,
    right: 0,
    top: 0,
  }));

  const overlayBottomStyle = useAnimatedStyle(() => ({
    height: displayHeight - cropTop.value - cropHeight.value,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  const overlayLeftStyle = useAnimatedStyle(() => ({
    width: cropLeft.value,
    left: 0,
    top: cropTop.value,
    height: cropHeight.value,
  }));

  const overlayRightStyle = useAnimatedStyle(() => ({
    width: displayWidth - cropLeft.value - cropWidth.value,
    right: 0,
    top: cropTop.value,
    height: cropHeight.value,
  }));

  const handleCrop = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      // Convert display coordinates back to original image coordinates
      const originX = (cropLeft.value / displayWidth) * imageWidth;
      const originY = (cropTop.value / displayHeight) * imageHeight;
      const width = (cropWidth.value / displayWidth) * imageWidth;
      const height = (cropHeight.value / displayHeight) * imageHeight;

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.round(width),
              height: Math.round(height),
            },
          },
        ],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (result.base64) {
        onCropComplete(result.base64, 'image/jpeg', result.uri);
      }
    } catch (error) {
      console.error('[ImageCropper] Crop error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, imageWidth, imageHeight, displayWidth, displayHeight, onCropComplete]);

  const handleSkipCrop = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      // Just convert to base64 without cropping
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (result.base64) {
        onCropComplete(result.base64, 'image/jpeg', result.uri);
      }
    } catch (error) {
      console.error('[ImageCropper] Skip crop error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, onCropComplete]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Crop Image</Text>
        <Pressable onPress={handleSkipCrop} style={styles.headerButton} disabled={isProcessing}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          Drag corners to resize • Drag center to move
        </Text>
      </View>

      <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: displayWidth, height: displayHeight }}
          contentFit="contain"
        />

        {/* Dark overlays outside crop area */}
        <Animated.View style={[styles.overlay, overlayTopStyle]} pointerEvents="none" />
        <Animated.View style={[styles.overlay, overlayBottomStyle]} pointerEvents="none" />
        <Animated.View style={[styles.overlay, overlayLeftStyle]} pointerEvents="none" />
        <Animated.View style={[styles.overlay, overlayRightStyle]} pointerEvents="none" />

        {/* Crop box */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.cropBox, cropBoxStyle]}>
            {/* Grid lines */}
            <View style={styles.gridContainer}>
              <View style={[styles.gridLineH, { top: '33.33%' }]} />
              <View style={[styles.gridLineH, { top: '66.66%' }]} />
              <View style={[styles.gridLineV, { left: '33.33%' }]} />
              <View style={[styles.gridLineV, { left: '66.66%' }]} />
            </View>

            {/* Corner handles */}
            <GestureDetector gesture={tlGesture}>
              <View style={[styles.handle, styles.handleTL]} />
            </GestureDetector>
            <GestureDetector gesture={trGesture}>
              <View style={[styles.handle, styles.handleTR]} />
            </GestureDetector>
            <GestureDetector gesture={blGesture}>
              <View style={[styles.handle, styles.handleBL]} />
            </GestureDetector>
            <GestureDetector gesture={brGesture}>
              <View style={[styles.handle, styles.handleBR]} />
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.cropButton, isProcessing && styles.cropButtonDisabled]}
          onPress={handleCrop}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="crop" size={20} color="#fff" />
              <Text style={styles.cropButtonText}>Crop & Continue</Text>
            </>
          )}
        </Pressable>
      </View>
    </GestureHandlerRootView>
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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerButton: {
      padding: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    skipText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    instructions: {
      padding: 12,
      alignItems: 'center',
    },
    instructionsText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    imageContainer: {
      alignSelf: 'center',
      marginTop: 20,
      position: 'relative',
    },
    overlay: {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    cropBox: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: '#fff',
    },
    gridContainer: {
      flex: 1,
      position: 'relative',
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    handle: {
      position: 'absolute',
      width: 30,
      height: 30,
      backgroundColor: '#fff',
      borderRadius: 15,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    handleTL: {
      top: -15,
      left: -15,
    },
    handleTR: {
      top: -15,
      right: -15,
    },
    handleBL: {
      bottom: -15,
      left: -15,
    },
    handleBR: {
      bottom: -15,
      right: -15,
    },
    footer: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 20,
      paddingBottom: 40,
    },
    cropButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    cropButtonDisabled: {
      opacity: 0.7,
    },
    cropButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
