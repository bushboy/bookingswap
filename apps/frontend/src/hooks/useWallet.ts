import { useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useWalletContext } from '@/contexts/WalletContext';
import {
  selectIsWalletConnected,
  selectConnectionStatus,
  selectCurrentProvider,
  selectAccountInfo,
  selectWalletAddress,
  selectWalletBalance,
  selectWalletNetwork,
  selectWalletError,
  selectAvailableProviders,
  selectTruncatedWalletAddress,
  selectCanConnect,
  selectCanDisconnect,
  selectShouldShowConnectButton,
  selectShouldShowWalletInfo,
  selectCanRetryConnection,
  selectNeedsProviderInstallation,
  selectNeedsNetworkSwitch,
  selectWalletUIState,
  selectIsConnecting,
  selectIsConnected,
  selectHasWalletError,
  selectWalletErrorMessage,
  selectWalletErrorType,
} from '@/store/selectors/walletSelectors';
import { WalletError } from '@/types/wallet';

/**
 * Main wallet hook that provides all wallet functionality
 */
export const useWallet = () => {
  const context = useWalletContext();

  // State selectors
  const isConnected = useAppSelector(selectIsWalletConnected);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const currentProvider = useAppSelector(selectCurrentProvider);
  const accountInfo = useAppSelector(selectAccountInfo);
  const walletAddress = useAppSelector(selectWalletAddress);
  const balance = useAppSelector(selectWalletBalance);
  const network = useAppSelector(selectWalletNetwork);
  const error = useAppSelector(selectWalletError);
  const availableProviders = useAppSelector(selectAvailableProviders);

  // Computed selectors
  const truncatedAddress = useAppSelector(selectTruncatedWalletAddress);
  const canConnect = useAppSelector(selectCanConnect);
  const canDisconnect = useAppSelector(selectCanDisconnect);
  const shouldShowConnectButton = useAppSelector(selectShouldShowConnectButton);
  const shouldShowWalletInfo = useAppSelector(selectShouldShowWalletInfo);
  const canRetryConnection = useAppSelector(selectCanRetryConnection);
  const needsProviderInstallation = useAppSelector(
    selectNeedsProviderInstallation
  );
  const needsNetworkSwitch = useAppSelector(selectNeedsNetworkSwitch);
  const uiState = useAppSelector(selectWalletUIState);

  // Status checks
  const isConnecting = useAppSelector(selectIsConnecting);
  const isWalletConnected = useAppSelector(selectIsConnected);
  const hasError = useAppSelector(selectHasWalletError);
  const errorMessage = useAppSelector(selectWalletErrorMessage);
  const errorType = useAppSelector(selectWalletErrorType);

  return {
    // Connection methods
    connect: context.connect,
    disconnect: context.disconnect,
    switchProvider: context.switchProvider,
    refreshAccountInfo: context.refreshAccountInfo,
    refreshBalance: context.refreshBalance,
    refreshAvailableProviders: context.refreshAvailableProviders,
    getProviderAvailabilityStatus: context.getProviderAvailabilityStatus,
    clearError: context.clearWalletError,

    // State
    isConnected,
    connectionStatus,
    currentProvider,
    accountInfo,
    walletAddress,
    balance,
    network,
    error,
    availableProviders,

    // Computed state
    truncatedAddress,
    canConnect,
    canDisconnect,
    shouldShowConnectButton,
    shouldShowWalletInfo,
    canRetryConnection,
    needsProviderInstallation,
    needsNetworkSwitch,
    uiState,

    // Status checks
    isConnecting,
    isWalletConnected,
    hasError,
    errorMessage,
    errorType,
  };
};

/**
 * Hook for wallet connection operations
 */
export const useWalletConnection = () => {
  const {
    connect,
    disconnect,
    switchProvider,
    isConnected,
    isConnecting,
    canConnect,
    canDisconnect,
  } = useWallet();

  const connectWallet = useCallback(
    async (providerId: string) => {
      if (!canConnect) {
        throw new Error('Cannot connect wallet at this time');
      }

      try {
        await connect(providerId);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
      }
    },
    [connect, canConnect]
  );

  const disconnectWallet = useCallback(async () => {
    if (!canDisconnect) {
      throw new Error('Cannot disconnect wallet at this time');
    }

    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }, [disconnect, canDisconnect]);

  const switchWalletProvider = useCallback(
    async (providerId: string) => {
      try {
        await switchProvider(providerId);
      } catch (error) {
        console.error('Failed to switch wallet provider:', error);
        throw error;
      }
    },
    [switchProvider]
  );

  return {
    connect: connectWallet,
    disconnect: disconnectWallet,
    switchProvider: switchWalletProvider,
    isConnected,
    isConnecting,
    canConnect,
    canDisconnect,
  };
};

/**
 * Hook for wallet account information
 */
export const useWalletAccount = () => {
  const {
    accountInfo,
    walletAddress,
    balance,
    network,
    truncatedAddress,
    refreshAccountInfo,
    refreshBalance,
  } = useWallet();

  return {
    accountInfo,
    address: walletAddress,
    balance,
    network,
    truncatedAddress,
    refreshAccountInfo,
    refreshBalance,
  };
};

/**
 * Hook for wallet error handling
 */
export const useWalletError = () => {
  const {
    error,
    hasError,
    errorMessage,
    errorType,
    clearError,
    canRetryConnection,
    needsProviderInstallation,
    needsNetworkSwitch,
  } = useWallet();

  const retryConnection = useCallback(async () => {
    if (!canRetryConnection) {
      throw new Error('Cannot retry connection at this time');
    }

    // Clear current error
    clearError();

    // The actual retry logic would depend on the last used provider
    // This would typically be handled by the auto-connect logic
  }, [canRetryConnection, clearError]);

  return {
    error,
    hasError,
    errorMessage,
    errorType,
    clearError,
    retryConnection,
    canRetryConnection,
    needsProviderInstallation,
    needsNetworkSwitch,
  };
};

/**
 * Hook for wallet provider management
 */
export const useWalletProviders = () => {
  const {
    availableProviders,
    currentProvider,
    refreshAvailableProviders,
    getProviderAvailabilityStatus,
    switchProvider,
  } = useWallet();

  const switchToProvider = useCallback(
    async (providerId: string) => {
      try {
        await switchProvider(providerId);
      } catch (error) {
        console.error('Failed to switch to provider:', error);
        throw error;
      }
    },
    [switchProvider]
  );

  return {
    availableProviders,
    currentProvider,
    refreshAvailableProviders,
    getProviderAvailabilityStatus,
    switchProvider: switchToProvider,
    hasProviders: availableProviders.length > 0,
  };
};

/**
 * Hook for wallet UI state
 */
export const useWalletUI = () => {
  const {
    uiState,
    shouldShowConnectButton,
    shouldShowWalletInfo,
    isConnecting,
    hasError,
  } = useWallet();

  return {
    ...uiState,
    shouldShowConnectButton,
    shouldShowWalletInfo,
    isConnecting,
    hasError,
  };
};

/**
 * Hook for wallet status checks
 */
export const useWalletStatus = () => {
  const {
    isConnected,
    isConnecting,
    connectionStatus,
    hasError,
    canConnect,
    canDisconnect,
  } = useWallet();

  return {
    isConnected,
    isConnecting,
    connectionStatus,
    hasError,
    canConnect,
    canDisconnect,
    isIdle: connectionStatus === 'idle',
    isError: connectionStatus === 'error',
  };
};
