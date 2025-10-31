import React, { useState, useRef, useCallback } from 'react';
import { tokens } from '@/design-system/tokens';
import { useTouch } from '@/hooks/useResponsive';

interface SwipeGestureHandlerProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  direction: 'left' | 'right' | null;
}

export const SwipeGestureHandler: React.FC<SwipeGestureHandlerProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 80,
  className,
  style,
}) => {
  const isTouch = useTouch();
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    direction: null,
  });
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTouch) return;
    
    const touch = e.touches[0];
    setSwipeState({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true,
      direction: null,
    });
    setIsSwipeActive(false);
  }, [isTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState.isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;

    // Determine if this is a horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault(); // Prevent scrolling
      
      const direction = deltaX > 0 ? 'right' : 'left';
      
      setSwipeState(prev => ({
        ...prev,
        currentX: touch.clientX,
        currentY: touch.clientY,
        direction,
      }));

      // Activate swipe if threshold is met
      if (Math.abs(deltaX) > swipeThreshold) {
        setIsSwipeActive(true);
      }

      // Apply visual feedback
      if (elementRef.current) {
        const maxTranslate = 120;
        const translateX = Math.max(-maxTranslate, Math.min(maxTranslate, deltaX * 0.3));
        elementRef.current.style.transform = `translateX(${translateX}px)`;
        elementRef.current.style.opacity = `${1 - Math.abs(deltaX) / 400}`;
      }
    }
  }, [swipeState.isDragging, swipeState.startX, swipeState.startY, swipeThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isDragging) return;

    const deltaX = swipeState.currentX - swipeState.startX;
    
    // Reset visual state
    if (elementRef.current) {
      elementRef.current.style.transform = 'translateX(0)';
      elementRef.current.style.opacity = '1';
    }

    // Trigger swipe action if threshold was met
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setSwipeState(prev => ({ ...prev, isDragging: false }));
    setIsSwipeActive(false);
  }, [swipeState, swipeThreshold, onSwipeLeft, onSwipeRight]);

  const containerStyles: React.CSSProperties = {
    position: 'relative',
    transition: swipeState.isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
    ...style,
  };

  return (
    <div
      ref={elementRef}
      className={className}
      style={containerStyles}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
      
      {/* Swipe indicators */}
      {isTouch && (onSwipeLeft || onSwipeRight) && (
        <div style={{
          position: 'absolute',
          bottom: tokens.spacing[2],
          right: tokens.spacing[2],
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colors.neutral[500],
          fontStyle: 'italic',
          pointerEvents: 'none',
          opacity: isSwipeActive ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out',
        }}>
          👈 👉 Swipe for actions
        </div>
      )}
    </div>
  );
};

// Hook for swipe gesture detection
export const useSwipeGesture = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  swipeThreshold: number = 80
) => {
  const isTouch = useTouch();
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    direction: null,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isTouch) return;
    
    const touch = e.touches[0];
    setSwipeState({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true,
      direction: null,
    });
  }, [isTouch]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeState.isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault();
      
      const direction = deltaX > 0 ? 'right' : 'left';
      
      setSwipeState(prev => ({
        ...prev,
        currentX: touch.clientX,
        currentY: touch.clientY,
        direction,
      }));
    }
  }, [swipeState.isDragging, swipeState.startX, swipeState.startY]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isDragging) return;

    const deltaX = swipeState.currentX - swipeState.startX;
    
    // Trigger swipe action if threshold was met
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setSwipeState(prev => ({ ...prev, isDragging: false }));
  }, [swipeState, swipeThreshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    isSwipeActive: swipeState.isDragging && Math.abs(swipeState.currentX - swipeState.startX) > swipeThreshold,
    swipeDirection: swipeState.direction,
  };
};