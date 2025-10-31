import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/design-system/tokens';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isStable } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication OR while auth state is stabilizing
  // This prevents race conditions during auth initialization
  if (isLoading || !isStable) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.neutral[50],
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: tokens.spacing[4],
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${tokens.colors.neutral[200]}`,
              borderTop: `3px solid ${tokens.colors.primary[600]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[600],
            }}
          >
            {!isStable ? 'Initializing authentication...' : 'Loading...'}
          </p>
        </div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // Only redirect to login if not authenticated AND auth state is stable
  // This prevents false positives during auth initialization
  if (!isAuthenticated) {
    console.log('🔒 LOGIN REDIRECT TRIGGERED by ProtectedRoute:', {
      component: 'ProtectedRoute',
      reason: 'User not authenticated after auth stabilization',
      conditions: {
        isAuthenticated: isAuthenticated,
        isLoading: isLoading,
        isStable: isStable,
        hasUser: !!useAuth().user,
        hasToken: !!useAuth().token
      },
      currentPath: location.pathname,
      redirectTo: '/login',
      timestamp: new Date().toISOString()
    });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
