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
    (state: RootState, providerId: string) => providerId,
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

export const selectCanConnect = createSelector(
  [selectConnectionStatus, selectHasAvailableProviders],
  (status, hasProviders) => status === 'idle' && hasProviders
);

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

// Statistics selectors
export const selectWalletStatistics = createSelector(
  [selectWalletState],
  walletState => ({
    totalProviders: walletState.availableProviders.length,
    hasConnection: walletState.isConnected,
    currentProvider: walletState.currentProvider,
    hasStoredPreferences: walletState.preferences.lastUsedProvider !== null,
    autoConnectEnabled: walletState.preferences.autoConnect,
  })
);
