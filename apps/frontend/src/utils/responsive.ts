import { tokens } from '@/design-system/tokens';

/**
 * Responsive utility functions and breakpoint helpers
 */

export interface ResponsiveValue<T> {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}

/**
 * Generate CSS media queries for responsive design
 */
export const mediaQueries = {
  sm: `@media (min-width: ${tokens.breakpoints.sm})`,
  md: `@media (min-width: ${tokens.breakpoints.md})`,
  lg: `@media (min-width: ${tokens.breakpoints.lg})`,
  xl: `@media (min-width: ${tokens.breakpoints.xl})`,
  '2xl': `@media (min-width: ${tokens.breakpoints['2xl']})`,

  // Max-width queries for mobile-first approach
  maxSm: `@media (max-width: ${parseInt(tokens.breakpoints.sm) - 1}px)`,
  maxMd: `@media (max-width: ${parseInt(tokens.breakpoints.md) - 1}px)`,
  maxLg: `@media (max-width: ${parseInt(tokens.breakpoints.lg) - 1}px)`,
  maxXl: `@media (max-width: ${parseInt(tokens.breakpoints.xl) - 1}px)`,

  // Touch device detection
  touch: '@media (hover: none) and (pointer: coarse)',
  hover: '@media (hover: hover) and (pointer: fine)',
} as const;

/**
 * Get responsive value based on current breakpoint
 */
export const getResponsiveValue = <T>(
  value: ResponsiveValue<T> | T,
  fallback?: T
): T => {
  if (typeof value !== 'object' || value === null) {
    return value as T;
  }

  const responsiveValue = value as ResponsiveValue<T>;

  // In a real implementation, you'd check window.innerWidth
  // For now, return base value or first available value
  return (responsiveValue.base ??
    responsiveValue.sm ??
    responsiveValue.md ??
    responsiveValue.lg ??
    responsiveValue.xl ??
    responsiveValue['2xl'] ??
    fallback) as T;
};

/**
 * Generate responsive grid columns
 */
export const getResponsiveGridColumns = (
  columns: ResponsiveValue<number>
): string => {
  const base = columns.base || 1;
  const sm = columns.sm || base;
  const md = columns.md || sm;
  const lg = columns.lg || md;
  const xl = columns.xl || lg;
  const xl2 = columns['2xl'] || xl;

  return `
    grid-template-columns: repeat(${base}, 1fr);
    
    ${mediaQueries.sm} {
      grid-template-columns: repeat(${sm}, 1fr);
    }
    
    ${mediaQueries.md} {
      grid-template-columns: repeat(${md}, 1fr);
    }
    
    ${mediaQueries.lg} {
      grid-template-columns: repeat(${lg}, 1fr);
    }
    
    ${mediaQueries.xl} {
      grid-template-columns: repeat(${xl}, 1fr);
    }
    
    ${mediaQueries['2xl']} {
      grid-template-columns: repeat(${xl2}, 1fr);
    }
  `;
};

/**
 * Generate responsive spacing
 */
export const getResponsiveSpacing = (
  spacing: ResponsiveValue<keyof typeof tokens.spacing>
): string => {
  const base = spacing.base || '4';
  const sm = spacing.sm || base;
  const md = spacing.md || sm;
  const lg = spacing.lg || md;
  const xl = spacing.xl || lg;
  const xl2 = spacing['2xl'] || xl;

  return `
    gap: ${tokens.spacing[base]};
    
    ${mediaQueries.sm} {
      gap: ${tokens.spacing[sm]};
    }
    
    ${mediaQueries.md} {
      gap: ${tokens.spacing[md]};
    }
    
    ${mediaQueries.lg} {
      gap: ${tokens.spacing[lg]};
    }
    
    ${mediaQueries.xl} {
      gap: ${tokens.spacing[xl]};
    }
    
    ${mediaQueries['2xl']} {
      gap: ${tokens.spacing[xl2]};
    }
  `;
};

/**
 * Common responsive breakpoint hooks
 */
export const useResponsive = () => {
  // In a real implementation, you'd use window.matchMedia
  // For now, return static values
  return {
    isMobile: false, // window.innerWidth < parseInt(tokens.breakpoints.md)
    isTablet: false, // window.innerWidth >= parseInt(tokens.breakpoints.md) && window.innerWidth < parseInt(tokens.breakpoints.lg)
    isDesktop: true, // window.innerWidth >= parseInt(tokens.breakpoints.lg)
    breakpoint: 'lg' as keyof typeof tokens.breakpoints,
  };
};

/**
 * Get full viewport height with proper fallbacks
 * Returns CSS string that handles both old and new viewport units
 */
export const getFullViewportHeight = (): string => `
  height: 100vh; /* Fallback for older browsers */
  height: 100dvh; /* Dynamic viewport height for modern browsers */
`;

/**
 * Touch-friendly sizing utilities
 */
export const touchTargets = {
  // Minimum 44px touch target size (iOS HIG recommendation)
  minSize: '44px',

  // Comfortable touch target size
  comfortable: '48px',

  // Large touch target for primary actions
  large: '56px',
} as const;

/**
 * Mobile-specific layout utilities
 */
export const mobileLayout = {
  // Safe area padding for mobile devices
  safeAreaPadding: {
    paddingTop: 'env(safe-area-inset-top)',
    paddingRight: 'env(safe-area-inset-right)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
  },

  // Full viewport height accounting for mobile browsers
  // Use getFullViewportHeight() function for proper fallback handling
  fullHeight: {
    height: '100dvh', // Dynamic viewport height (use getFullViewportHeight() for fallbacks)
  },

  // Prevent zoom on input focus (iOS)
  preventZoom: {
    fontSize: '16px', // Minimum font size to prevent zoom
  },
} as const;

/**
 * Responsive container widths
 */
export const containerWidths = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  full: '100%',
} as const;

/**
 * Generate responsive container styles
 */
export const getContainerStyles = (
  maxWidth: keyof typeof containerWidths = 'xl'
) => ({
  width: '100%',
  maxWidth: containerWidths[maxWidth],
  marginLeft: 'auto',
  marginRight: 'auto',
  paddingLeft: tokens.spacing[4],
  paddingRight: tokens.spacing[4],

  [`${mediaQueries.sm}`]: {
    paddingLeft: tokens.spacing[6],
    paddingRight: tokens.spacing[6],
  },

  [`${mediaQueries.lg}`]: {
    paddingLeft: tokens.spacing[8],
    paddingRight: tokens.spacing[8],
  },
});
