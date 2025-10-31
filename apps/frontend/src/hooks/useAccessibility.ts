import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for managing focus and keyboard navigation
 */
export const useFocusManagement = () => {
  const focusableElementsSelector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
    '[role="button"]:not([disabled])',
    '[role="link"]:not([disabled])',
  ].join(', ');

  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(focusableElementsSelector));
  }, [focusableElementsSelector]);

  const trapFocus = useCallback((container: HTMLElement, event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, [getFocusableElements]);

  const focusFirstElement = useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [getFocusableElements]);

  const restoreFocus = useCallback((element: HTMLElement | null) => {
    if (element && typeof element.focus === 'function') {
      // Use setTimeout to ensure the element is ready to receive focus
      setTimeout(() => {
        element.focus();
      }, 0);
    }
  }, []);

  return {
    trapFocus,
    focusFirstElement,
    restoreFocus,
    getFocusableElements,
  };
};

/**
 * Hook for managing ARIA live regions for screen reader announcements
 */
export const useAriaLiveRegion = () => {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region if it doesn't exist
    if (!liveRegionRef.current) {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
      liveRegionRef.current = liveRegion;
    }

    return () => {
      if (liveRegionRef.current && document.body.contains(liveRegionRef.current)) {
        document.body.removeChild(liveRegionRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);
      liveRegionRef.current.textContent = message;

      // Clear the message after a short delay to allow for repeated announcements
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return { announce };
};

/**
 * Hook for keyboard navigation support
 */
export const useKeyboardNavigation = (
  onEnter?: () => void,
  onEscape?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  onArrowLeft?: () => void,
  onArrowRight?: () => void
) => {
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        if (onEnter) {
          event.preventDefault();
          onEnter();
        }
        break;
      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
      case 'ArrowUp':
        if (onArrowUp) {
          event.preventDefault();
          onArrowUp();
        }
        break;
      case 'ArrowDown':
        if (onArrowDown) {
          event.preventDefault();
          onArrowDown();
        }
        break;
      case 'ArrowLeft':
        if (onArrowLeft) {
          event.preventDefault();
          onArrowLeft();
        }
        break;
      case 'ArrowRight':
        if (onArrowRight) {
          event.preventDefault();
          onArrowRight();
        }
        break;
    }
  }, [onEnter, onEscape, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]);

  return { handleKeyDown };
};

/**
 * Hook for managing interface transitions with accessibility announcements
 */
export const useInterfaceTransition = () => {
  const { announce } = useAriaLiveRegion();
  const { restoreFocus } = useFocusManagement();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const announceTransition = useCallback((
    fromInterface: string,
    toInterface: string,
    context?: string
  ) => {
    const message = context
      ? `Navigated from ${fromInterface} to ${toInterface}. ${context}`
      : `Navigated from ${fromInterface} to ${toInterface}`;

    announce(message, 'polite');
  }, [announce]);

  const storeFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restorePreviousFocus = useCallback(() => {
    restoreFocus(previousFocusRef.current);
  }, [restoreFocus]);

  return {
    announceTransition,
    storeFocus,
    restorePreviousFocus,
  };
};

/**
 * Hook for high contrast mode detection and support
 */
export const useHighContrast = () => {
  const isHighContrast = useCallback(() => {
    // Check for Windows high contrast mode
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-contrast: high)').matches ||
        window.matchMedia('(-ms-high-contrast: active)').matches ||
        window.matchMedia('(-ms-high-contrast: black-on-white)').matches ||
        window.matchMedia('(-ms-high-contrast: white-on-black)').matches;
    }
    return false;
  }, []);

  const getHighContrastStyles = useCallback(() => {
    if (!isHighContrast()) return {};

    return {
      border: '2px solid',
      outline: '2px solid',
      backgroundColor: 'ButtonFace',
      color: 'ButtonText',
    };
  }, [isHighContrast]);

  return {
    isHighContrast: isHighContrast(),
    getHighContrastStyles,
  };
};

/**
 * Hook for reduced motion preference detection and support
 */
export const useReducedMotion = () => {
  const prefersReducedMotion = useCallback(() => {
    // Check for user's reduced motion preference
    if (window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, []);

  const getMotionStyles = useCallback((
    animatedStyles: React.CSSProperties,
    staticStyles: React.CSSProperties = {}
  ) => {
    if (prefersReducedMotion()) {
      return {
        ...staticStyles,
        animation: 'none',
        transition: 'none',
        transform: 'none',
      };
    }
    return animatedStyles;
  }, [prefersReducedMotion]);

  const shouldReduceMotion = prefersReducedMotion();

  return {
    shouldReduceMotion,
    prefersReducedMotion: shouldReduceMotion,
    getMotionStyles,
  };
};

/**
 * Hook for announcements - alias for useAriaLiveRegion for backward compatibility
 * @deprecated Use useAriaLiveRegion instead
 */
export const useAnnouncements = useAriaLiveRegion;

/**
 * Hook for generating unique IDs for accessibility
 */
export const useId = (prefix: string = 'id') => {
  const idRef = useRef<string>();

  if (!idRef.current) {
    idRef.current = `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  return idRef.current;
};