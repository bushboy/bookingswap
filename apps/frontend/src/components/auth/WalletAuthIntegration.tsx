import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';

/**
 * Component that integrates wallet state with the existing authentication system.
 * This component handles the connection between wallet authentication and traditional auth.
 */
export const WalletAuthIntegration: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isConnected, accountInfo, disconnect } = useWallet();

  // Handle wallet disconnection when user logs out
  useEffect(() => {
    if (!isAuthenticated && isConnected) {
      // Add a small delay to prevent disconnecting wallet due to temporary auth issues
      const timeoutId = setTimeout(() => {
        // Double-check that user is still not authenticated before disconnecting wallet
        if (!isAuthenticated) {
          console.log('WalletAuthIntegration: User logged out, disconnecting wallet');
          disconnect().catch(console.error);
        }
      }, 1000); // 1 second delay to prevent premature disconnection

      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated, isConnected, disconnect]);

  // Log wallet connection status for debugging
  useEffect(() => {
    if (isAuthenticated && isConnected && accountInfo) {
      console.log('User authenticated with wallet:', {
        userId: accountInfo.accountId,
        network: accountInfo.network,
        address: accountInfo.accountId,
      });
    }
  }, [isAuthenticated, isConnected, accountInfo]);

  // This component doesn't render anything - it's just for side effects
  return null;
};
