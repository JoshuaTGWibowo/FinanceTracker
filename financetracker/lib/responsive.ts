import { useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';

/**
 * Responsive Design Utilities
 * 
 * Provides helpers to make the app look great on all screen sizes
 * from iPhone SE to iPhone 14 Pro Max and beyond.
 */

export interface ScreenSize {
  width: number;
  height: number;
  isSmallDevice: boolean;
  isMediumDevice: boolean;
  isLargeDevice: boolean;
  scale: number;
}

/**
 * Get current screen dimensions and device category
 */
export const useScreenSize = (): ScreenSize => {
  return useMemo(() => {
    const { width, height } = Dimensions.get('window');
    
    // Device categories based on width
    // Small: iPhone SE, iPhone 12/13 mini (< 375px)
    // Medium: iPhone 13, 14, 15 (375-400px)
    // Large: iPhone 14 Pro Max, Plus models (> 400px)
    const isSmallDevice = width < 375;
    const isMediumDevice = width >= 375 && width < 400;
    const isLargeDevice = width >= 400;
    
    // Calculate a scale factor for responsive sizing
    // Base size: 390px (iPhone 14 Pro)
    const baseWidth = 390;
    const scale = width / baseWidth;
    
    return {
      width,
      height,
      isSmallDevice,
      isMediumDevice,
      isLargeDevice,
      scale,
    };
  }, []);
};

/**
 * Scale a value based on screen size
 * @param size - Base size designed for iPhone 14 Pro (390px width)
 * @param options - Scaling options
 */
export const scaleSize = (
  size: number,
  options?: {
    min?: number;
    max?: number;
    factor?: number;
  }
): number => {
  const { width } = Dimensions.get('window');
  const baseWidth = 390;
  const scale = width / baseWidth;
  
  const factor = options?.factor ?? 1;
  let scaled = size * scale * factor;
  
  if (options?.min !== undefined) {
    scaled = Math.max(options.min, scaled);
  }
  
  if (options?.max !== undefined) {
    scaled = Math.min(options.max, scaled);
  }
  
  return Math.round(scaled);
};

/**
 * Get responsive font size
 * Scales down on smaller devices, up on larger devices
 */
export const responsiveFontSize = (baseSize: number): number => {
  return scaleSize(baseSize, { 
    min: baseSize * 0.85,  // Don't go smaller than 85% 
    max: baseSize * 1.15,  // Don't go larger than 115%
  });
};

/**
 * Get responsive spacing
 * Maintains proportional spacing across devices
 */
export const responsiveSpacing = (baseSpacing: number): number => {
  return scaleSize(baseSpacing, {
    min: baseSpacing * 0.8,
    max: baseSpacing * 1.2,
  });
};

/**
 * Get responsive horizontal padding for main content areas
 */
export const getContentPadding = (): number => {
  const { width, isSmallDevice } = useScreenSize();
  
  if (isSmallDevice) {
    return 12; // Reduced padding for small screens
  }
  
  if (width < 390) {
    return 16;
  }
  
  if (width > 430) {
    return 24; // More padding on very large screens
  }
  
  return 20; // Default
};

/**
 * Check if device has small screen (iPhone SE, 13 mini, etc)
 */
export const isSmallScreen = (): boolean => {
  const { width } = Dimensions.get('window');
  return width < 375;
};

/**
 * Check if device has large screen (Pro Max, Plus models)
 */
export const isLargeScreen = (): boolean => {
  const { width } = Dimensions.get('window');
  return width > 400;
};

/**
 * Get number of columns for grid layouts based on screen size
 */
export const getGridColumns = (options?: {
  small?: number;
  medium?: number;
  large?: number;
}): number => {
  const { isSmallDevice, isMediumDevice, isLargeDevice } = useScreenSize();
  
  if (isSmallDevice) return options?.small ?? 2;
  if (isMediumDevice) return options?.medium ?? 3;
  if (isLargeDevice) return options?.large ?? 4;
  
  return 3;
};

/**
 * Get responsive value based on device size
 */
export const responsiveValue = <T,>(values: {
  small: T;
  medium: T;
  large: T;
}): T => {
  const { isSmallDevice, isMediumDevice, isLargeDevice } = useScreenSize();
  
  if (isSmallDevice) return values.small;
  if (isMediumDevice) return values.medium;
  if (isLargeDevice) return values.large;
  
  return values.medium;
};
