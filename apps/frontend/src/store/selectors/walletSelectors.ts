import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { WalletErrorType } from '../../types/wallet';

// Base selectors
const selectWalletState = (state: RootState) => state.wallet;

// Connection state selectors
export const selectIsWalletConnected = createSelector(
  [selectWalletState],
  walletState => walletState.isConnected
);

export const selectConnectionStatus = createSelector(
  [selectWalletState],
  walletState => walletState.connectionStatus
);

export const selectCurrentProvider = createSelector(
  [selectWalletState],
  walletState => walletState.currentProvider
);

export const selectAccountInfo = createSelector(
  [selectWalletState],
  walletState => walletState.accountInfo
);

export const selectWalletAddress = createSelector(
  [selectAccountInfo],
  accountInfo => accountInfo?.accountId || null
);

export const selectWalletBalance = createSelector(
  [selectAccountInfo],
  accountInfo => accountInfo?.balance || '0'
);

export const selectWalletNetwork = createSelector(
  [selectAccountInfo],
  accountInfo => accountInfo?.network || null
);

// Provider management selectors
export const selectAvailableProviders = createSelector(
  [selectWalletState],
  walletState => walletState.availableProviders
);

export const selectHasAvailableProviders = createSelector(
  [selectAvailableProviders],
  providers => providers.length > 0
);

export const selectIsProviderAvailable = createSelector(
  [
    selectAvailableProviders,
    (_: RootState, providerId: string) => providerId,
  ],
  (providers, providerId) => providers.includes(providerId)
);

// Error handling selectors
export const selectWalletError = createSelector(
  [selectWalletState],
  walletState => walletState.error
);

export const selectHasWalletError = createSelector(
  [selectWalletError],
  error => error !== null
);

export const selectWalletErrorType = createSelector(
  [selectWalletError],
  error => error?.type || null
);

export const selectWalletErrorMessage = createSelector(
  [selectWalletError],
  error => error?.message || null
);

// Connection status checks
export const selectIsConnecting = createSelector(
  [selectConnectionStatus],
  status => status === 'connecting'
);

export const selectIsConnected = createSelector(
  [selectConnectionStatus],
  status => status === 'connected'
);

export const selectIsIdle = createSelector(
  [selectConnectionStatus],
  status => status === 'idle'
);

export const selectHasConnectionError = createSelector(
  [selectConnectionStatus],
  status => status === 'error'
);

// Preferences selectors
export const selectWalletPreferences = createSelector(
  [selectWalletState],
  walletState => walletState.preferences
);

export const selectLastUsedProvider = createSelector(
  [selectWalletPreferences],
  preferences => preferences.lastUsedProvider
);

export const selectAutoConnect = createSelector(
  [selectWalletPreferences],
  preferences => preferences.autoConnect
);

// Computed selectors
export const selectTruncatedWalletAddress = createSelector(
  [selectWalletAddress],
  address => {
    if (!address) return null;
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
);

// Removed - replaced by selectCanConnectWallet with enhanced validation

export const selectCanDisconnect = createSelector(
  [selectIsWalletConnected],
  isConnected => isConnected
);

export const selectShouldShowConnectButton = createSelector(
  [selectIsWalletConnected, selectIsConnecting],
  (isConnected, isConnecting) => !isConnected && !isConnecting
);

export const selectShouldShowWalletInfo = createSelector(
  [selectIsWalletConnected, selectAccountInfo],
  (isConnected, accountInfo) => isConnected && accountInfo !== null
);

// Error type specific selectors
export const selectIsProviderNotFoundError = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.PROVIDER_NOT_FOUND
);

export const selectIsConnectionRejectedError = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.CONNECTION_REJECTED
);

export const selectIsWalletLockedError = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.WALLET_LOCKED
);

export const selectIsWrongNetworkError = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.WRONG_NETWORK
);

export const selectIsNetworkError = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.NETWORK_ERROR
);

// Validation selectors
export const selectCanRetryConnection = createSelector(
  [selectWalletErrorType, selectAvailableProviders, selectLastUsedProvider],
  (errorType, availableProviders, lastUsedProvider) => {
    // Can retry if there was a network error or unknown error
    const retryableErrors = [
      WalletErrorType.NETWORK_ERROR,
      WalletErrorType.UNKNOWN_ERROR,
      WalletErrorType.WALLET_LOCKED,
    ];

    return (
      retryableErrors.includes(errorType as WalletErrorType) &&
      lastUsedProvider !== null &&
      availableProviders.includes(lastUsedProvider)
    );
  }
);

export const selectNeedsProviderInstallation = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.PROVIDER_NOT_FOUND
);

export const selectNeedsNetworkSwitch = createSelector(
  [selectWalletErrorType],
  errorType => errorType === WalletErrorType.WRONG_NETWORK
);

// Connection restoration selectors
export const selectShouldAttemptAutoConnect = createSelector(
  [
    selectAutoConnect,
    selectLastUsedProvider,
    selectAvailableProviders,
    selectConnectionStatus,
    selectIsWalletConnected,
  ],
  (autoConnect, lastUsedProvider, availableProviders, status, isConnected) => {
    return (
      autoConnect &&
      lastUsedProvider !== null &&
      availableProviders.includes(lastUsedProvider) &&
      status === 'idle' &&
      !isConnected
    );
  }
);

// UI state selectors
export const selectWalletUIState = createSelector(
  [
    selectIsWalletConnected,
    selectConnectionStatus,
    selectWalletError,
    selectAccountInfo,
    selectAvailableProviders,
  ],
  (isConnected, status, error, accountInfo, availableProviders) => ({
    isConnected,
    status,
    error,
    accountInfo,
    hasProviders: availableProviders.length > 0,
    showConnectButton: !isConnected && status !== 'connecting',
    showWalletInfo: isConnected && accountInfo !== null,
    showError: error !== null,
    showLoading: status === 'connecting',
  })
);

// New selectors for serializable state management
export const selectIsWalletInitialized = createSelector(
  [selectWalletState],
  walletState => walletState.isInitialized
);

export const selectLastStateUpdate = createSelector(
  [selectWalletState],
  walletState => walletState.lastStateUpdate
);

export const selectWalletErrorTimestamp = createSelector(
  [selectWalletError],
  error => error?.timestamp || null
);

export const selectAccountLastUpdated = createSelector(
  [selectAccountInfo],
  accountInfo => accountInfo?.lastUpdated || null
);

// Enhanced connection validation selector with comprehensive validation logic
export const selectCanConnectWallet = createSelector(
  [
    selectConnectionStatus,
    selectHasAvailableProviders,
    selectIsWalletInitialized,
    selectHasWalletError,
    selectWalletErrorType,
  ],
  (status, hasProviders, isInitialized, hasError, errorType) => {
    // Basic requirements
    if (status !== 'idle' || !hasProviders || !isInitialized) {
      return false;
    }

    // Check for blocking errors
    if (hasError && errorType) {
      const blockingErrorTypes = [
        WalletErrorType.PROVIDER_NOT_FOUND,
        WalletErrorType.CONNECTION_REJECTED,
        WalletErrorType.WALLET_LOCKED,
      ];

      if (blockingErrorTypes.includes(errorType)) {
        return false;
      }
    }

    return true;
  }
);

// Update the original selectCanConnect to use enhanced validation
export const selectCanConnect = selectCanConnectWallet;

// Connection validation selectors
export const selectConnectionBlockers = createSelector(
  [
    selectConnectionStatus,
    selectHasAvailableProviders,
    selectIsWalletInitialized,
    selectHasWalletError,
    selectWalletErrorType,
  ],
  (status, hasProviders, isInitialized, hasError, errorType) => {
    const blockers: string[] = [];

    if (status !== 'idle') {
      if (status === 'connecting') {
        blockers.push('Connection already in progress');
      } else if (status === 'connected') {
        blockers.push('Wallet already connected');
      } else if (status === 'error') {
        blockers.push('Connection error state');
      }
    }

    if (!hasProviders) {
      blockers.push('No wallet providers available');
    }

    if (!isInitialized) {
      blockers.push('Wallet service not initialized');
    }

    if (hasError && errorType) {
      const blockingErrorTypes = [
        WalletErrorType.PROVIDER_NOT_FOUND,
        WalletErrorType.CONNECTION_REJECTED,
        WalletErrorType.WALLET_LOCKED,
      ];

      if (blockingErrorTypes.includes(errorType)) {
        blockers.push(`Blocking error: ${errorType}`);
      }
    }

    return blockers;
  }
);

export const selectConnectionValidationState = createSelector(
  [
    selectCanConnectWallet,
    selectConnectionBlockers,
    selectConnectionStatus,
    selectIsWalletInitialized,
    selectHasAvailableProviders,
    selectWalletError,
  ],
  (canConnect, blockers, status, isInitialized, hasProviders, error) => ({
    canConnect,
    blockers,
    isValid: canConnect,
    details: {
      walletServiceInitialized: isInitialized,
      hasActiveConnection: status === 'connected',
      providersAvailable: hasProviders,
      hasBlockingErrors: error !== null,
      connectionStatus: status,
    },
    warnings: [] as string[], // Can be populated with non-blocking warnings
  })
);

export const selectHasConnectionBlockers = createSelector(
  [selectConnectionBlockers],
  blockers => blockers.length > 0
);

export const selectConnectionValidationDetails = createSelector(
  [
    selectIsWalletInitialized,
    selectConnectionStatus,
    selectHasAvailableProviders,
    selectHasWalletError,
    selectWalletErrorType,
    selectCurrentProvider,
  ],
  (isInitialized, status, hasProviders, hasError, errorType, currentProvider) => ({
    walletServiceInitialized: isInitialized,
    hasActiveConnection: status === 'connected',
    providersAvailable: hasProviders,
    hasBlockingErrors: hasError && errorType ? [
      WalletErrorType.PROVIDER_NOT_FOUND,
      WalletErrorType.CONNECTION_REJECTED,
      WalletErrorType.WALLET_LOCKED,
    ].includes(errorType) : false,
    reduxStateConsistent: true, // Assume consistent within Redux
    currentConnectionStatus: status,
    currentProvider,
    lastError: errorType,
  })
);

// Edge case handling selectors
export const selectConnectionEdgeCases = createSelector(
  [
    selectConnectionStatus,
    selectIsWalletConnected,
    selectCurrentProvider,
    selectAccountInfo,
  ],
  (status, isConnected, currentProvider, accountInfo) => {
    const edgeCases: string[] = [];

    // Check for state inconsistencies
    if (status === 'connected' && !isConnected) {
      edgeCases.push('Status connected but isConnected false');
    }

    if (isConnected && status !== 'connected') {
      edgeCases.push('IsConnected true but status not connected');
    }

    if (isConnected && !currentProvider) {
      edgeCases.push('Connected but no current provider');
    }

    if (currentProvider && !isConnected) {
      edgeCases.push('Has current provider but not connected');
    }

    if (isConnected && !accountInfo) {
      edgeCases.push('Connected but no account info');
    }

    return {
      hasEdgeCases: edgeCases.length > 0,
      edgeCases,
      isStateConsistent: edgeCases.length === 0,
    };
  }
);

// Provider-specific validation selectors
export const selectProviderValidationState = createSelector(
  [
    selectAvailableProviders,
    selectCurrentProvider,
    (_: RootState, providerId?: string) => providerId,
  ],
  (availableProviders, currentProvider, targetProviderId) => {
    if (!targetProviderId) {
      return {
        isValid: false,
        blockers: ['No provider specified'],
        isAvailable: false,
        isRegistered: false,
        isCurrent: false,
      };
    }

    const isAvailable = availableProviders.includes(targetProviderId);
    const isCurrent = currentProvider === targetProviderId;
    const blockers: string[] = [];

    if (!isAvailable) {
      blockers.push(`Provider ${targetProviderId} is not available`);
    }

    return {
      isValid: isAvailable,
      blockers,
      isAvailable,
      isRegistered: isAvailable, // Assume registered if available
      isCurrent,
    };
  }
);

// Statistics selectors
export const selectWalletStatistics = createSelector(
  [selectWalletState],
  walletState => ({
    totalProviders: walletState.availableProviders.length,
    hasConnection: walletState.isConnected,
    currentProvider: walletState.currentProvider,
    hasStoredPreferences: walletState.preferences.lastUsedProvider !== null,
    autoConnectEnabled: walletState.preferences.autoConnect,
    isInitialized: walletState.isInitialized,
    lastStateUpdate: walletState.lastStateUpdate,
  })
);
