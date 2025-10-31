import { useState, useEffect } from 'react';
import { tokens } from '@/design-system/tokens';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: keyof typeof tokens.breakpoints | 'xs';
  width: number;
  height: number;
}

/**
 * Hook to track responsive breakpoints and screen size
 */
export const useResponsive = (): ResponsiveState => {
  const [state, setState] = useState<ResponsiveState>(() => {
    // Initialize with safe defaults for SSR
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        breakpoint: 'lg' as const,
        width: 1024,
        height: 768,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      isMobile: width < parseInt(tokens.breakpoints.md),
      isTablet:
        width >= parseInt(tokens.breakpoints.md) &&
        width < parseInt(tokens.breakpoints.lg),
      isDesktop: width >= parseInt(tokens.breakpoints.lg),
      breakpoint: getBreakpoint(width),
      width,
      height,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setState({
        isMobile: width < parseInt(tokens.breakpoints.md),
        isTablet:
          width >= parseInt(tokens.breakpoints.md) &&
          width < parseInt(tokens.breakpoints.lg),
        isDesktop: width >= parseInt(tokens.breakpoints.lg),
        breakpoint: getBreakpoint(width),
        width,
        height,
      });
    };

    window.addEventListener('resize', handleResize);

    // Call once to set initial state
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return state;
};

/**
 * Get the current breakpoint based on width
 */
const getBreakpoint = (
  width: number
): keyof typeof tokens.breakpoints | 'xs' => {
  if (width >= parseInt(tokens.breakpoints['2xl'])) return '2xl';
  if (width >= parseInt(tokens.breakpoints.xl)) return 'xl';
  if (width >= parseInt(tokens.breakpoints.lg)) return 'lg';
  if (width >= parseInt(tokens.breakpoints.md)) return 'md';
  if (width >= parseInt(tokens.breakpoints.sm)) return 'sm';
  return 'xs';
};

/**
 * Hook to detect touch devices
 */
export const useTouch = () => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    checkTouch();

    // Listen for touch events to detect touch capability
    const handleTouchStart = () => setIsTouch(true);

    window.addEventListener('touchstart', handleTouchStart, { once: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  return isTouch;
};

/**
 * Hook for media query matching
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
