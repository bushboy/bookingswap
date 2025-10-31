import { useCallback, useMemo } from 'react';
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
  selectCanConnectWallet,
  selectConnectionBlockers,
  selectConnectionValidationState,
  selectHasConnectionBlockers,
  selectConnectionValidationDetails,
  selectConnectionEdgeCases,
  selectProviderValidationState,
} from '@/store/selectors/walletSelectors';
import { walletService, ConnectionValidator } from '@/services/wallet';

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

  // Enhanced validation selectors
  const canConnectWallet = useAppSelector(selectCanConnectWallet);
  const connectionBlockers = useAppSelector(selectConnectionBlockers);
  const validationState = useAppSelector(selectConnectionValidationState);
  const hasBlockers = useAppSelector(selectHasConnectionBlockers);

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
    canConnect: canConnectWallet, // Use enhanced validation
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

    // Enhanced validation properties
    connectionBlockers,
    validationState,
    hasBlockers,
  };
};

/**
 * Hook for wallet connection operations with enhanced validation
 */
export const useWalletConnection = () => {
  const {
    connect,
    disconnect,
    switchProvider,
    isConnected,
    isConnecting,
    canDisconnect,
  } = useWallet();

  // Enhanced validation selectors
  const canConnectWallet = useAppSelector(selectCanConnectWallet);
  const connectionBlockers = useAppSelector(selectConnectionBlockers);
  const validationState = useAppSelector(selectConnectionValidationState);
  const hasBlockers = useAppSelector(selectHasConnectionBlockers);

  // Create connection validator instance
  const connectionValidator = useMemo(() => {
    return new ConnectionValidator(walletService);
  }, []);

  const connectWallet = useCallback(
    async (providerId: string) => {
      // Debug logging for connection attempts
      console.log('🔌 Attempting to connect wallet:', providerId);

      // Check service status before connection
      const serviceStatus = walletService.validateServiceState();
      console.log('🔍 Wallet service status:', serviceStatus);

      // Use enhanced validation instead of simple canConnect
      if (!canConnectWallet) {
        const blockers = connectionBlockers.length > 0
          ? connectionBlockers.join(', ')
          : 'Unknown validation error';

        console.error('❌ Cannot connect wallet:', {
          providerId,
          blockers: connectionBlockers,
          serviceStatus,
        });

        throw new Error(`Cannot connect wallet: ${blockers}`);
      }

      // Validate specific provider
      const providerValidation = connectionValidator.validateProviderAvailability(providerId);
      if (!providerValidation.isValid) {
        const blockers = providerValidation.blockers.join(', ');
        throw new Error(`Cannot connect to ${providerId}: ${blockers}`);
      }

      // Initialize wallet service if needed
      try {
        await connectionValidator.initializeIfNeeded();
      } catch (error) {
        console.error('Failed to initialize wallet service:', error);
        throw new Error('Wallet service initialization failed');
      }

      try {
        await connect(providerId);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
      }
    },
    [connect, canConnectWallet, connectionBlockers, connectionValidator]
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
      // Validate provider before switching
      const providerValidation = connectionValidator.validateProviderAvailability(providerId);
      if (!providerValidation.isValid) {
        const blockers = providerValidation.blockers.join(', ');
        throw new Error(`Cannot switch to ${providerId}: ${blockers}`);
      }

      try {
        await switchProvider(providerId);
      } catch (error) {
        console.error('Failed to switch wallet provider:', error);
        throw error;
      }
    },
    [switchProvider, connectionValidator]
  );

  const validateConnection = useCallback(() => {
    return connectionValidator.validateConnectionState();
  }, [connectionValidator]);

  const getConnectionSummary = useCallback(() => {
    return connectionValidator.getValidationSummary();
  }, [connectionValidator]);

  return {
    connect: connectWallet,
    disconnect: disconnectWallet,
    switchProvider: switchWalletProvider,
    isConnected,
    isConnecting,
    canConnect: canConnectWallet,
    canDisconnect,
    // Enhanced validation properties
    connectionBlockers,
    validationState,
    hasBlockers,
    validateConnection,
    getConnectionSummary,
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
    canDisconnect,
  } = useWallet();

  const canConnect = useAppSelector(selectCanConnectWallet);

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

/**
 * Hook for wallet connection validation with detailed error information
 */
export const useWalletValidation = () => {
  const canConnectWallet = useAppSelector(selectCanConnectWallet);
  const connectionBlockers = useAppSelector(selectConnectionBlockers);
  const validationState = useAppSelector(selectConnectionValidationState);
  const validationDetails = useAppSelector(selectConnectionValidationDetails);
  const edgeCases = useAppSelector(selectConnectionEdgeCases);
  const hasBlockers = useAppSelector(selectHasConnectionBlockers);

  // Create connection validator instance
  const connectionValidator = useMemo(() => {
    return new ConnectionValidator(walletService);
  }, []);

  const validateConnection = useCallback(() => {
    return connectionValidator.validateConnectionState();
  }, [connectionValidator]);

  const validateProvider = useCallback((providerId: string) => {
    return connectionValidator.validateProviderAvailability(providerId);
  }, [connectionValidator]);

  const initializeIfNeeded = useCallback(async () => {
    return connectionValidator.initializeIfNeeded();
  }, [connectionValidator]);

  const getValidationSummary = useCallback(() => {
    return connectionValidator.getValidationSummary();
  }, [connectionValidator]);

  const getConnectionErrorMessage = useCallback(() => {
    if (connectionBlockers.length === 0) {
      return null;
    }

    if (connectionBlockers.length === 1) {
      return connectionBlockers[0];
    }

    return `Multiple issues prevent connection: ${connectionBlockers.join(', ')}`;
  }, [connectionBlockers]);

  return {
    // Validation state
    canConnect: canConnectWallet,
    connectionBlockers,
    validationState,
    validationDetails,
    edgeCases,
    hasBlockers,

    // Validation methods
    validateConnection,
    validateProvider,
    initializeIfNeeded,
    getValidationSummary,
    getConnectionErrorMessage,

    // Convenience properties
    isValid: canConnectWallet,
    errorMessage: getConnectionErrorMessage(),
    hasEdgeCases: edgeCases.hasEdgeCases,
    isStateConsistent: edgeCases.isStateConsistent,
  };
};

/**
 * Hook for provider-specific validation
 */
export const useProviderValidation = (providerId?: string) => {
  const providerValidation = useAppSelector(state =>
    selectProviderValidationState(state, providerId)
  );

  const connectionValidator = useMemo(() => {
    return new ConnectionValidator(walletService);
  }, []);

  const validateProvider = useCallback(() => {
    if (!providerId) {
      return {
        isValid: false,
        blockers: ['No provider specified'],
        error: new Error('No provider specified'),
      };
    }

    return connectionValidator.validateProviderAvailability(providerId);
  }, [providerId, connectionValidator]);

  return {
    ...providerValidation,
    validateProvider,
    providerId,
  };
};
