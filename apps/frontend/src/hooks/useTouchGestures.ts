import { useRef, useEffect, useCallback } from 'react';

export interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  preventScroll?: boolean;
}

export interface TouchGestureState {
  startX: number;
  startY: number;
  startTime: number;
  isLongPress: boolean;
  longPressTimer: NodeJS.Timeout | null;
}

/**
 * Hook for handling touch gestures on mobile devices
 * Provides swipe detection, tap handling, and long press support
 */
export const useTouchGestures = (options: TouchGestureOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onLongPress,
    swipeThreshold = 50,
    longPressDelay = 500,
    preventScroll = false,
  } = options;

  const gestureState = useRef<TouchGestureState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isLongPress: false,
    longPressTimer: null,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const state = gestureState.current;

    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.startTime = Date.now();
    state.isLongPress = false;

    // Clear any existing long press timer
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
    }

    // Start long press timer if handler is provided
    if (onLongPress) {
      state.longPressTimer = setTimeout(() => {
        state.isLongPress = true;
        onLongPress();
      }, longPressDelay);
    }

    if (preventScroll) {
      e.preventDefault();
    }
  }, [onLongPress, longPressDelay, preventScroll]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const state = gestureState.current;

    // Cancel long press if user moves finger
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }

    if (preventScroll) {
      e.preventDefault();
    }
  }, [preventScroll]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const state = gestureState.current;

    // Clear long press timer
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }

    // Don't process tap if it was a long press
    if (state.isLongPress) {
      return;
    }

    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const deltaTime = Date.now() - state.startTime;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Check for swipe gestures
    if (absX > swipeThreshold || absY > swipeThreshold) {
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    } else if (deltaTime < 300 && absX < 10 && absY < 10) {
      // Tap gesture (quick touch with minimal movement)
      if (onTap) {
        onTap();
      }
    }

    if (preventScroll) {
      e.preventDefault();
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, swipeThreshold, preventScroll]);

  const attachGestures = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: !preventScroll });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
    element.addEventListener('touchend', handleTouchEnd, { passive: !preventScroll });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const state = gestureState.current;
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
      }
    };
  }, []);

  return { attachGestures };
};

/**
 * Hook for pull-to-refresh functionality
 */
export const usePullToRefresh = (onRefresh: () => void | Promise<void>, threshold = 80) => {
  const pullState = useRef({
    startY: 0,
    currentY: 0,
    isPulling: false,
    isRefreshing: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start pull if at top of page
    if (window.scrollY === 0) {
      pullState.current.startY = e.touches[0].clientY;
      pullState.current.isPulling = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const state = pullState.current;
    
    if (!state.isPulling || state.isRefreshing) return;

    state.currentY = e.touches[0].clientY;
    const pullDistance = state.currentY - state.startY;

    // Only prevent default if pulling down
    if (pullDistance > 0 && window.scrollY === 0) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    const state = pullState.current;
    
    if (!state.isPulling || state.isRefreshing) return;

    const pullDistance = state.currentY - state.startY;

    if (pullDistance > threshold) {
      state.isRefreshing = true;
      try {
        await onRefresh();
      } finally {
        state.isRefreshing = false;
      }
    }

    state.isPulling = false;
    state.startY = 0;
    state.currentY = 0;
  }, [onRefresh, threshold]);

  const attachPullToRefresh = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { 
    attachPullToRefresh,
    isRefreshing: pullState.current.isRefreshing,
  };
};