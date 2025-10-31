import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { tokens } from '@/design-system/tokens';
import { WalletConnectButton } from '@/components/wallet';

interface WalletProtectedRouteProps {
  children: React.ReactNode;
  requireWallet?: boolean;
  fallbackMessage?: string;
}

/**
 * Route component that can optionally require wallet connection
 * for certain features while still allowing access to the page.
 */
export const WalletProtectedRoute: React.FC<WalletProtectedRouteProps> = ({
  children,
  requireWallet = false,
  fallbackMessage = 'Connect your wallet to access advanced trading features.',
}) => {
  const { isAuthenticated } = useAuth();
  const { isConnected, isConnecting } = useWallet();

  // If user is not authenticated, let ProtectedRoute handle it
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // If wallet is not required, always show children
  if (!requireWallet) {
    return <>{children}</>;
  }

  // If wallet is required but not connected, show wallet connection prompt
  if (requireWallet && !isConnected && !isConnecting) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: tokens.spacing[8],
          textAlign: 'center',
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.lg,
          border: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <div
          style={{
            marginBottom: tokens.spacing[6],
            maxWidth: '400px',
          }}
        >
          <h2
            style={{
              fontSize: tokens.typography.fontSize['2xl'],
              fontWeight: tokens.typography.fontWeight.bold,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[4],
            }}
          >
            Wallet Connection Required
          </h2>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[600],
              lineHeight: tokens.typography.lineHeight.relaxed,
              marginBottom: tokens.spacing[6],
            }}
          >
            {fallbackMessage}
          </p>
          <WalletConnectButton
            variant="primary"
            size="lg"
            showBalance={false}
          />
        </div>
      </div>
    );
  }

  // If wallet is connecting, show loading state
  if (isConnecting) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: tokens.spacing[8],
          textAlign: 'center',
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
            marginBottom: tokens.spacing[4],
          }}
        />
        <p
          style={{
            fontSize: tokens.typography.fontSize.base,
            color: tokens.colors.neutral[600],
          }}
        >
          Connecting wallet...
        </p>
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

  // Wallet is connected or not required, show children
  return <>{children}</>;
};
