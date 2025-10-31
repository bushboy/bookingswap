import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { walletService } from '@/services/wallet/WalletService';
import { userService } from '@/services/userService';
import { initializeWalletProviders } from '@/services/wallet/providers';
import {
  connectWalletStart,
  connectWalletSuccess,
  connectWalletFailure,
  disconnectWallet,
  updateAccountInfo,
  updateBalance,
  setAvailableProviders,
  setError,
  clearError,
  setPreferences,
} from '@/store/slices/walletSlice';
import {
  selectIsWalletConnected,
  selectConnectionStatus,
  selectCurrentProvider,
  selectAccountInfo,
  selectWalletError,
  selectAvailableProviders,
  selectWalletPreferences,
  selectShouldAttemptAutoConnect,
} from '@/store/selectors/walletSelectors';
import { WalletConnection, AccountInfo, WalletError } from '@/types/wallet';

interface WalletContextValue {
  // Connection methods
  connect: (providerId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  switchProvider: (providerId: string) => Promise<void>;
  refreshAccountInfo: () => Promise<void>;
  refreshBalance: () => Promise<void>;

  // Provider management
  refreshAvailableProviders: () => Promise<void>;
  getProviderAvailabilityStatus: () => Promise<Record<string, boolean>>;

  // Error handling
  clearWalletError: () => void;

  // State
  isConnected: boolean;
  connectionStatus: string;
  currentProvider: string | null;
  accountInfo: AccountInfo | null;
  error: WalletError | null;
  availableProviders: string[];
}

const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({
  children,
}) => {
  const dispatch = useAppDispatch();

  // Selectors
  const isConnected = useAppSelector(selectIsWalletConnected);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const currentProvider = useAppSelector(selectCurrentProvider);
  const accountInfo = useAppSelector(selectAccountInfo);
  const error = useAppSelector(selectWalletError);
  const availableProviders = useAppSelector(selectAvailableProviders);
  const preferences = useAppSelector(selectWalletPreferences);
  const shouldAttemptAutoConnect = useAppSelector(
    selectShouldAttemptAutoConnect
  );

  // Helper function to update user wallet address
  const updateUserWalletAddress = useCallback(async (walletAddress: string) => {
    console.log('DEBUG: Attempting to update user wallet address:', walletAddress);
    try {
      const updatedUser = await userService.updateWallet(walletAddress);
      console.log('DEBUG: User wallet address updated successfully:', {
        walletAddress,
        updatedUser: updatedUser.walletAddress
      });
    } catch (error) {
      console.error('DEBUG: Failed to update user wallet address:', error);
      // Don't throw error here as wallet connection should still succeed
      // even if backend update fails
    }
  }, []);

  // Connection methods
  const connect = useCallback(
    async (providerId: string) => {
      try {
        dispatch(connectWalletStart(providerId));

        const connection = await walletService.connect(providerId);
        const accountInfo = await walletService.getAccountInfo();

        // Save account info to storage
        walletService.saveAccountInfo(accountInfo);

        // Update user's wallet address in the backend
        console.log('DEBUG: Wallet connected, account info:', accountInfo);
        if (accountInfo.accountId) {
          console.log('DEBUG: Calling updateUserWalletAddress with:', accountInfo.accountId);
          await updateUserWalletAddress(accountInfo.accountId);
        } else {
          console.warn('DEBUG: No accountId found in accountInfo:', accountInfo);
        }

        dispatch(
          connectWalletSuccess({
            connection,
            accountInfo,
            provider: providerId,
          })
        );
      } catch (error) {
        const walletError = error as WalletError;
        dispatch(connectWalletFailure(walletError));
        throw error;
      }
    },
    [dispatch, updateUserWalletAddress]
  );

  const disconnect = useCallback(async () => {
    try {
      await walletService.disconnect();
      dispatch(disconnectWallet());
    } catch (error) {
      const walletError = error as WalletError;
      dispatch(setError(walletError));
      throw error;
    }
  }, [dispatch]);

  const switchProvider = useCallback(
    async (providerId: string) => {
      try {
        dispatch(connectWalletStart(providerId));

        const connection = await walletService.switchProvider(providerId);
        const accountInfo = await walletService.getAccountInfo();

        // Save account info to storage
        walletService.saveAccountInfo(accountInfo);

        // Update user's wallet address in the backend
        if (accountInfo.accountId) {
          await updateUserWalletAddress(accountInfo.accountId);
        }

        dispatch(
          connectWalletSuccess({
            connection,
            accountInfo,
            provider: providerId,
          })
        );
      } catch (error) {
        const walletError = error as WalletError;
        dispatch(connectWalletFailure(walletError));
        throw error;
      }
    },
    [dispatch, updateUserWalletAddress]
  );

  const refreshAccountInfo = useCallback(async () => {
    try {
      if (!walletService.isConnected()) {
        return;
      }

      const accountInfo = await walletService.getAccountInfo();
      // Save updated account info to storage
      walletService.saveAccountInfo(accountInfo);
      dispatch(updateAccountInfo(accountInfo));
    } catch (error) {
      const walletError = error as WalletError;
      dispatch(setError(walletError));
    }
  }, [dispatch]);

  const refreshBalance = useCallback(async () => {
    try {
      if (!walletService.isConnected()) {
        return;
      }

      const balance = await walletService.getBalance();
      dispatch(updateBalance(balance));
    } catch (error) {
      const walletError = error as WalletError;
      dispatch(setError(walletError));
    }
  }, [dispatch]);

  // Provider management
  const refreshAvailableProviders = useCallback(async () => {
    try {
      const providers = await walletService.getAvailableProviders();
      const providerIds = providers.map(provider => provider.id);
      dispatch(setAvailableProviders(providerIds));
    } catch (error) {
      console.warn('Failed to refresh available providers:', error);
    }
  }, [dispatch]);

  const getProviderAvailabilityStatus = useCallback(async () => {
    try {
      const availabilityStatus =
        await walletService.getProviderAvailabilityStatus();
      return Object.fromEntries(availabilityStatus);
    } catch (error) {
      console.warn('Failed to get provider availability status:', error);
      return {};
    }
  }, []);

  // Error handling
  const clearWalletError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Connection restoration logic
  const attemptConnectionRestoration = useCallback(async () => {
    if (!shouldAttemptAutoConnect) {
      return;
    }

    try {
      const connection = await walletService.restoreConnection();
      if (connection) {
        // Try to load cached account info first
        let accountInfo = walletService.loadAccountInfo();

        // If no cached account info or it's expired, fetch fresh data
        if (!accountInfo) {
          try {
            accountInfo = await walletService.getAccountInfo();
            // Save the fresh account info
            walletService.saveAccountInfo(accountInfo);
          } catch (error) {
            console.warn(
              'Failed to fetch account info during restoration:',
              error
            );
            // Use basic account info from connection
            accountInfo = {
              accountId: connection.accountId,
              balance: '0',
              network: connection.network,
            };
          }
        }

        dispatch(
          connectWalletSuccess({
            connection,
            accountInfo,
            provider: preferences.lastUsedProvider!,
          })
        );
      }
    } catch (error) {
      console.warn('Failed to restore wallet connection:', error);
      // Update preferences to disable auto-connect on failure
      walletService.updatePreferences({ autoConnect: false });
      dispatch(setPreferences({ lastUsedProvider: null, autoConnect: false }));
    }
  }, [dispatch, shouldAttemptAutoConnect, preferences.lastUsedProvider]);

  // Initialize wallet service and set up event listeners
  useEffect(() => {
    // Initialize wallet providers first
    initializeWalletProviders();

    // Set up wallet service event listeners
    const handleConnect = (connection: WalletConnection) => {
      // Connection is handled by the connect method
    };

    const handleDisconnect = () => {
      dispatch(disconnectWallet());
    };

    const handleAccountChanged = (accountInfo: AccountInfo) => {
      dispatch(updateAccountInfo(accountInfo));
    };

    const handleNetworkChanged = (network: string) => {
      // Refresh account info when network changes
      refreshAccountInfo();
    };

    const handleError = (error: WalletError) => {
      dispatch(setError(error));
    };

    const handleProviderChanged = (providerId: string) => {
      // Provider change is handled by connect/switch methods
    };

    const handleProvidersAvailabilityChanged = (data: {
      availableProviders: string[];
    }) => {
      dispatch(setAvailableProviders(data.availableProviders));
    };

    // Add event listeners
    walletService.addEventListener('connect', handleConnect);
    walletService.addEventListener('disconnect', handleDisconnect);
    walletService.addEventListener('accountChanged', handleAccountChanged);
    walletService.addEventListener('networkChanged', handleNetworkChanged);
    walletService.addEventListener('error', handleError);
    walletService.addEventListener('providerChanged', handleProviderChanged);
    walletService.addEventListener(
      'providersAvailabilityChanged',
      handleProvidersAvailabilityChanged
    );

    // Initial setup
    refreshAvailableProviders();

    // Attempt connection restoration after a short delay to allow providers to initialize
    const restoreTimer = setTimeout(() => {
      attemptConnectionRestoration();
    }, 1000);

    // Cleanup
    return () => {
      clearTimeout(restoreTimer);
      walletService.removeEventListener('connect', handleConnect);
      walletService.removeEventListener('disconnect', handleDisconnect);
      walletService.removeEventListener('accountChanged', handleAccountChanged);
      walletService.removeEventListener('networkChanged', handleNetworkChanged);
      walletService.removeEventListener('error', handleError);
      walletService.removeEventListener(
        'providerChanged',
        handleProviderChanged
      );
      walletService.removeEventListener(
        'providersAvailabilityChanged',
        handleProvidersAvailabilityChanged
      );
    };
  }, [
    dispatch,
    refreshAvailableProviders,
    attemptConnectionRestoration,
    refreshAccountInfo,
  ]);

  // Periodic balance refresh for connected wallets
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    // Refresh balance every 30 seconds
    const balanceInterval = setInterval(() => {
      refreshBalance();
    }, 30000);

    return () => {
      clearInterval(balanceInterval);
    };
  }, [isConnected, refreshBalance]);

  const contextValue: WalletContextValue = {
    // Methods
    connect,
    disconnect,
    switchProvider,
    refreshAccountInfo,
    refreshBalance,
    refreshAvailableProviders,
    getProviderAvailabilityStatus,
    clearWalletError,

    // State
    isConnected,
    connectionStatus,
    currentProvider,
    accountInfo,
    error,
    availableProviders,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = (): WalletContextValue => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error(
      'useWalletContext must be used within a WalletContextProvider'
    );
  }
  return context;
};
