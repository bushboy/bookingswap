/**
 * Mobile performance optimization utilities
 * Provides functions to improve performance on mobile devices
 */

/**
 * Debounce function for touch events and input handling
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
};

/**
 * Throttle function for scroll and resize events
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Optimize images for mobile devices
 */
export const optimizeImageForMobile = (
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string => {
  const { width = 800, height, quality = 80, format = 'webp' } = options;
  
  // If it's already a data URL or blob, return as-is
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }
  
  // Simple URL parameter approach (would need actual image service)
  const params = new URLSearchParams();
  params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());
  params.set('f', format);
  
  return `${src}?${params.toString()}`;
};

/**
 * Lazy loading utility for mobile
 */
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }
  
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px', // Load content 50px before it comes into view
    threshold: 0.1,
    ...options,
  };
  
  return new IntersectionObserver(callback, defaultOptions);
};

/**
 * Optimize CSS animations for mobile
 */
export const getMobileOptimizedAnimationStyles = (isMobile: boolean) => ({
  // Reduce motion for users who prefer it
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none',
  },
  
  // Use transform and opacity for better performance
  willChange: isMobile ? 'transform, opacity' : 'auto',
  
  // Enable hardware acceleration on mobile
  ...(isMobile && {
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    perspective: 1000,
  }),
});

/**
 * Memory management for mobile devices
 */
export class MobileMemoryManager {
  private static instance: MobileMemoryManager;
  private observers: Set<() => void> = new Set();
  private isLowMemory = false;
  
  static getInstance(): MobileMemoryManager {
    if (!MobileMemoryManager.instance) {
      MobileMemoryManager.instance = new MobileMemoryManager();
    }
    return MobileMemoryManager.instance;
  }
  
  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for memory pressure events
      if ('memory' in performance) {
        this.monitorMemoryUsage();
      }
      
      // Listen for page visibility changes
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
  
  private monitorMemoryUsage = () => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usedRatio > 0.8 && !this.isLowMemory) {
          this.isLowMemory = true;
          this.notifyObservers();
        } else if (usedRatio < 0.6 && this.isLowMemory) {
          this.isLowMemory = false;
        }
      }
    };
    
    // Check memory usage every 30 seconds
    setInterval(checkMemory, 30000);
  };
  
  private handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is hidden, trigger cleanup
      this.notifyObservers();
    }
  };
  
  private notifyObservers = () => {
    this.observers.forEach(callback => callback());
  };
  
  onMemoryPressure(callback: () => void): () => void {
    this.observers.add(callback);
    
    // Return cleanup function
    return () => {
      this.observers.delete(callback);
    };
  }
  
  getIsLowMemory(): boolean {
    return this.isLowMemory;
  }
  
  cleanup() {
    this.observers.clear();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}

/**
 * Touch event optimization
 */
export const optimizeTouchEvents = (element: HTMLElement) => {
  // Add touch-action CSS property to prevent default behaviors
  element.style.touchAction = 'manipulation';
  
  // Prevent 300ms click delay on mobile
  element.style.cursor = 'pointer';
  
  // Improve scrolling performance
  element.style.webkitOverflowScrolling = 'touch';
  
  // Enable hardware acceleration
  element.style.transform = 'translateZ(0)';
};

/**
 * Viewport utilities for mobile
 */
export const getViewportInfo = () => {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      isPortrait: true,
      devicePixelRatio: 1,
    };
  }
  
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    isPortrait: window.innerHeight > window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
};

/**
 * Safe area utilities for devices with notches
 */
export const getSafeAreaInsets = () => {
  if (typeof window === 'undefined' || !CSS.supports('padding', 'env(safe-area-inset-top)')) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
  }
  
  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
    right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
    bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
    left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0,
  };
};

/**
 * Network-aware loading for mobile
 */
export const getNetworkInfo = () => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return {
      effectiveType: '4g',
      downlink: 10,
      saveData: false,
    };
  }
  
  const connection = (navigator as any).connection;
  
  return {
    effectiveType: connection.effectiveType || '4g',
    downlink: connection.downlink || 10,
    saveData: connection.saveData || false,
  };
};

/**
 * Adaptive loading based on network conditions
 */
export const shouldLoadHighQualityContent = (): boolean => {
  const { effectiveType, saveData } = getNetworkInfo();
  
  // Don't load high quality content on slow networks or when save data is enabled
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return false;
  }
  
  return true;
};