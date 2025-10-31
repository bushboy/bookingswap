/**
 * Lazy-loaded components for code splitting and performance optimization
 * 
 * This module provides lazy-loaded versions of components to reduce initial bundle size
 * and improve loading performance for the separated booking and swap interfaces.
 * 
 * Requirements addressed:
 * - 6.1: Intuitive navigation between booking editing and swap creation
 * - 6.2: Logical next steps after completing booking edits  
 * - 6.3: Clear navigation back to booking management
 * - 6.4: Proper browser navigation handling
 * - 6.5: Deep linking support
 * - 6.6: Bookmark functionality
 * - 6.7: Appropriate URLs for sharing
 * - 6.8: Efficient navigation patterns for frequent context switching
 */

import React, { Suspense } from 'react';
import { createLazyComponent, preloadComponent, performanceMonitor } from '@/utils/performanceOptimizations';
import { tokens } from '@/design-system/tokens';

// Loading fallback component
const LoadingFallback: React.FC<{ componentName?: string }> = ({ componentName }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '60vh',
    flexDirection: 'column',
    gap: tokens.spacing[4],
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: `3px solid ${tokens.colors.neutral[200]}`,
      borderTop: `3px solid ${tokens.colors.primary[600]}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <p style={{
      color: tokens.colors.neutral[600],
      fontSize: tokens.typography.fontSize.base,
    }}>
      Loading {componentName || 'component'}...
    </p>
  </div>
);

// Error boundary for lazy loading failures
class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
    performanceMonitor.clearMetrics(); // Clear metrics on error
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      if (FallbackComponent) {
        return <FallbackComponent />;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: tokens.spacing[6],
          padding: tokens.spacing[6],
        }}>
          <div style={{
            padding: tokens.spacing[6],
            backgroundColor: tokens.colors.error[50],
            border: `1px solid ${tokens.colors.error[200]}`,
            borderRadius: tokens.borderRadius.lg,
            textAlign: 'center',
            maxWidth: '500px',
          }}>
            <div style={{
              fontSize: tokens.typography.fontSize.xl,
              marginBottom: tokens.spacing[3],
            }}>
              ⚠️
            </div>
            <h2 style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.error[800],
              marginBottom: tokens.spacing[3],
            }}>
              Failed to Load Component
            </h2>
            <p style={{
              color: tokens.colors.error[700],
              fontSize: tokens.typography.fontSize.base,
              marginBottom: tokens.spacing[4],
              lineHeight: 1.5,
            }}>
              There was an error loading this page. Please try refreshing or contact support if the problem persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                backgroundColor: tokens.colors.primary[600],
                color: 'white',
                border: 'none',
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.base,
                cursor: 'pointer',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for lazy loading with error boundary and suspense
const withLazyLoading = <P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  componentName: string,
  fallbackComponent?: React.ComponentType
) => {
  return React.forwardRef<any, P>((props, ref) => (
    <LazyLoadErrorBoundary fallback={fallbackComponent}>
      <Suspense fallback={<LoadingFallback componentName={componentName} />}>
        <LazyComponent {...props} ref={ref} />
      </Suspense>
    </LazyLoadErrorBoundary>
  ));
};

// Lazy-loaded BookingSwapSpecificationPage - Main target for code splitting
export const LazyBookingSwapSpecificationPage = createLazyComponent(
  () => import('@/pages/BookingSwapSpecificationPage'),
  {
    retryCount: 3,
    timeout: 15000, // Longer timeout for larger component
  }
);

export const BookingSwapSpecificationPageWithLoading = withLazyLoading(
  LazyBookingSwapSpecificationPage,
  'Swap Specification Page'
);

// Lazy-loaded SwapPreferencesSection - Heavy component with complex logic
export const LazySwapPreferencesSection = createLazyComponent(
  () => import('@/components/booking/SwapPreferencesSection'),
  {
    retryCount: 2,
    timeout: 10000,
  }
);

export const SwapPreferencesSectionWithLoading = withLazyLoading(
  LazySwapPreferencesSection,
  'Swap Preferences'
);

// Lazy-loaded UnifiedSwapEnablement - Wallet integration component
export const LazyUnifiedSwapEnablement = createLazyComponent(
  () => import('@/components/swap/UnifiedSwapEnablement'),
  {
    retryCount: 2,
    timeout: 10000,
  }
);

export const UnifiedSwapEnablementWithLoading = withLazyLoading(
  LazyUnifiedSwapEnablement,
  'Swap Enablement'
);

// Temporary direct import to test if lazy loading is the issue
import { SwapsPage } from '@/pages/SwapsPage';

export const SwapsPageWithLoading = SwapsPage;

// Temporary direct import to test if lazy loading is the issue
import { BrowsePage } from '@/pages/BrowsePage';

export const BrowsePageWithLoading = BrowsePage;

// Lazy-loaded DashboardPage - Analytics and overview
export const LazyDashboardPage = createLazyComponent(
  () => import('@/pages/DashboardPage'),
  {
    retryCount: 2,
    timeout: 10000,
  }
);

export const DashboardPageWithLoading = withLazyLoading(
  LazyDashboardPage,
  'Dashboard'
);

// Lazy-loaded ProfilePage - User profile management
export const LazyProfilePage = createLazyComponent(
  () => import('@/pages/ProfilePage'),
  {
    retryCount: 2,
    timeout: 8000,
  }
);

export const ProfilePageWithLoading = withLazyLoading(
  LazyProfilePage,
  'Profile'
);

// Lazy-loaded AdminPage - Admin interface
export const LazyAdminPage = createLazyComponent(
  () => import('@/pages/AdminPage'),
  {
    retryCount: 2,
    timeout: 12000,
  }
);

export const AdminPageWithLoading = withLazyLoading(
  LazyAdminPage,
  'Admin Panel'
);

// Preloading functions for critical user paths
export const preloadSwapComponents = async (): Promise<void> => {
  // Preload swap-related components when user shows intent to use swapping
  await Promise.all([
    preloadComponent(() => import('@/pages/BookingSwapSpecificationPage')),
    preloadComponent(() => import('@/components/booking/SwapPreferencesSection')),
    preloadComponent(() => import('@/components/swap/UnifiedSwapEnablement')),
  ]);
};

export const preloadBookingComponents = async (): Promise<void> => {
  // Preload booking-related components for faster navigation
  await Promise.all([
    preloadComponent(() => import('@/pages/BookingsPage')),
    preloadComponent(() => import('@/components/booking/BookingEditForm')),
  ]);
};

export const preloadSecondaryPages = async (): Promise<void> => {
  // Preload secondary pages in the background
  await Promise.all([
    preloadComponent(() => import('@/pages/SwapsPage')),
    preloadComponent(() => import('@/pages/BrowsePage')),
    preloadComponent(() => import('@/pages/DashboardPage')),
  ]);
};

// Intelligent preloading based on user behavior
export const intelligentPreload = {
  // Preload swap components when user hovers over "Enable Swapping" button
  onSwapButtonHover: () => {
    preloadSwapComponents().catch(console.warn);
  },

  // Preload booking components when user navigates to bookings
  onBookingsPageLoad: () => {
    preloadBookingComponents().catch(console.warn);
  },

  // Preload secondary pages after main content loads
  onMainContentLoaded: () => {
    // Delay to avoid interfering with main content
    setTimeout(() => {
      preloadSecondaryPages().catch(console.warn);
    }, 2000);
  },

  // Preload based on user's most visited pages
  onUserPreferencesLoad: (visitedPages: string[]) => {
    const preloadPromises: Promise<void>[] = [];

    if (visitedPages.includes('/swaps')) {
      preloadPromises.push(preloadComponent(() => import('@/pages/SwapsPage')));
    }

    if (visitedPages.includes('/browse')) {
      preloadPromises.push(preloadComponent(() => import('@/pages/BrowsePage')));
    }

    if (visitedPages.includes('/dashboard')) {
      preloadPromises.push(preloadComponent(() => import('@/pages/DashboardPage')));
    }

    Promise.all(preloadPromises).catch(console.warn);
  },
};

// Export performance monitoring utilities
export { performanceMonitor } from '@/utils/performanceOptimizations';