import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';

/**
 * Hook that combines traditional authentication with wallet connection state
 * to provide a unified authentication experience.
 */
export const useWalletAuth = () => {
  const { isAuthenticated, user, token, logout } = useAuth();
  const {
    isConnected: isWalletConnected,
    accountInfo,
    walletAddress,
    network,
    disconnect: disconnectWallet,
  } = useWallet();

  // Combined authentication state
  const authState = useMemo(
    () => ({
      // Traditional auth
      isAuthenticated,
      user,
      token,

      // Wallet auth
      isWalletConnected,
      walletAddress,
      accountInfo,
      network,

      // Combined states
      isFullyAuthenticated: isAuthenticated && isWalletConnected,
      hasWalletAuth: isWalletConnected && !!accountInfo,
      canAccessWalletFeatures: isAuthenticated && isWalletConnected,
    }),
    [
      isAuthenticated,
      user,
      token,
      isWalletConnected,
      walletAddress,
      accountInfo,
      network,
    ]
  );

  // Combined logout function
  const logoutAll = async () => {
    try {
      // Disconnect wallet first
      if (isWalletConnected) {
        await disconnectWallet();
      }
    } catch (error) {
      console.error('Error disconnecting wallet during logout:', error);
    } finally {
      // Always logout from traditional auth
      logout();
    }
  };

  return {
    ...authState,
    logout: logoutAll,
  };
};

/**
 * Hook for checking if user can access wallet-protected features
 */
export const useWalletFeatureAccess = () => {
  const { isAuthenticated } = useAuth();
  const { isConnected, accountInfo } = useWallet();

  return {
    canAccessWalletFeatures: isAuthenticated && isConnected && !!accountInfo,
    needsAuth: !isAuthenticated,
    needsWallet: isAuthenticated && !isConnected,
    isReady: isAuthenticated && isConnected && !!accountInfo,
  };
};
