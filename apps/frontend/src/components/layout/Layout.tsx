import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSelector } from '@/store/hooks';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import { ComponentErrorBoundary } from '@/components/error/ComponentErrorBoundary';
import { HeaderFallback } from '@/components/error/HeaderFallback';
import { SidebarFallback } from '@/components/error/SidebarFallback';
import { MainContentFallback } from '@/components/error/MainContentFallback';
import { tokens } from '@/design-system/tokens';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const sidebarOpen = useAppSelector(state => state.ui.sidebarOpen);
  const location = useLocation();

  // Show loading spinner during authentication checks
  if (isLoading) {
    const loadingStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: tokens.colors.neutral[50],
      flexDirection: 'column' as const,
      gap: tokens.spacing[4],
    };

    const loadingTextStyles = {
      color: tokens.colors.neutral[600],
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.medium,
    };

    return (
      <div style={loadingStyles}>
        <LoadingSpinner size="lg" />
        <p style={loadingTextStyles}>Loading...</p>
      </div>
    );
  }

  const layoutStyles = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: tokens.colors.neutral[50],
  };

  // For authenticated users, show sidebar and adjust main content margin
  const mainStyles = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    marginLeft: isAuthenticated && sidebarOpen ? '256px' : '0',
    transition: 'margin-left 0.3s ease-in-out',
  };

  const contentStyles = {
    flex: 1,
    padding: tokens.spacing[6],
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  };

  return (
    <div style={layoutStyles}>
      {/* Only show sidebar for authenticated users - wrapped with error boundary */}
      {isAuthenticated && (
        <ComponentErrorBoundary
          fallback={SidebarFallback}
          componentName="Sidebar"
          resetOnPropsChange={true}
          onError={(error, errorInfo) => {
            console.error('Sidebar component error:', error, errorInfo);
          }}
        >
          <Sidebar isAuthenticated={isAuthenticated} />
        </ComponentErrorBoundary>
      )}

      <div style={mainStyles}>
        {/* Wrap Header with error boundary to ensure navigation remains functional */}
        <ComponentErrorBoundary
          fallback={HeaderFallback}
          componentName="Header"
          resetOnPropsChange={true}
          onError={(error, errorInfo) => {
            console.error('Header component error:', error, errorInfo);
          }}
        >
          <Header isAuthenticated={isAuthenticated} />
        </ComponentErrorBoundary>

        {/* Wrap main content with error boundary to ensure core application structure remains stable */}
        <ComponentErrorBoundary
          fallback={MainContentFallback}
          componentName="Main Content"
          resetOnPropsChange={true}
          onError={(error, errorInfo) => {
            console.error('Main content error:', error, errorInfo);
          }}
        >
          <main style={contentStyles}>
            {/* Render children if provided (for direct usage), otherwise use Outlet for routing */}
            {children || (
              <Outlet key={location.key || location.pathname} />
            )}
          </main>
        </ComponentErrorBoundary>
      </div>
    </div>
  );
};
