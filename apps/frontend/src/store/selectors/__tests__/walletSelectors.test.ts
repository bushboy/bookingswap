import { describe, it, expect } from 'vitest';
import { RootState } from '../../index';
import {
  WalletErrorType,
  AccountInfo,
  WalletError,
} from '../../../types/wallet';
import {
  selectIsWalletConnected,
  selectConnectionStatus,
  selectCurrentProvider,
  selectAccountInfo,
  selectWalletAddress,
  selectWalletBalance,
  selectWalletNetwork,
  selectAvailableProviders,
  selectHasAvailableProviders,
  selectIsProviderAvailable,
  selectWalletError,
  selectHasWalletError,
  selectWalletErrorType,
  selectWalletErrorMessage,
  selectIsConnecting,
  selectIsConnected,
  selectIsIdle,
  selectHasConnectionError,
  selectWalletPreferences,
  selectLastUsedProvider,
  selectAutoConnect,
  selectTruncatedWalletAddress,
  selectCanConnect,
  selectCanDisconnect,
  selectShouldShowConnectButton,
  selectShouldShowWalletInfo,
  selectIsProviderNotFoundError,
  selectIsConnectionRejectedError,
  selectIsWalletLockedError,
  selectIsWrongNetworkError,
  selectIsNetworkError,
  selectCanRetryConnection,
  selectNeedsProviderInstallation,
  selectNeedsNetworkSwitch,
  selectShouldAttemptAutoConnect,
  selectWalletUIState,
  selectWalletStatistics,
} from '../walletSelectors';

describe('walletSelectors', () => {
  const mockAccountInfo: AccountInfo = {
    accountId: '0.0.123456',
    balance: '100.5',
    network: 'testnet',
  };

  const mockError: WalletError = {
    type: WalletErrorType.CONNECTION_REJECTED,
    message: 'User rejected the connection request',
  };

  const createMockState = (walletOverrides = {}): RootState =>
    ({
      wallet: {
        isConnected: false,
        currentProvider: null,
        accountInfo: null,
        connectionStatus: 'idle',
        error: null,
        availableProviders: [],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
        ...walletOverrides,
      },
      // Mock other state slices
      auth: {
        isAuthenticated: false,
        user: null,
        walletConnected: false,
        loading: false,
        error: null,
      },
      bookings: { bookings: [], loading: false, error: null },
      swaps: { swaps: [], loading: false, error: null },
      auctions: {
        auctions: [],
        proposals: {},
        userAuctions: [],
        userProposals: [],
        filters: {},
        loading: false,
        error: null,
      },
      ui: { theme: 'light', sidebarOpen: false },
      dashboard: { stats: null, loading: false, error: null },
      notifications: [],
    }) as RootState;

  describe('connection state selectors', () => {
    it('should select wallet connection status', () => {
      const state = createMockState({ isConnected: true });
      expect(selectIsWalletConnected(state)).toBe(true);
    });

    it('should select connection status', () => {
      const state = createMockState({ connectionStatus: 'connecting' });
      expect(selectConnectionStatus(state)).toBe('connecting');
    });

    it('should select current provider', () => {
      const state = createMockState({ currentProvider: 'hashpack' });
      expect(selectCurrentProvider(state)).toBe('hashpack');
    });

    it('should select account info', () => {
      const state = createMockState({ accountInfo: mockAccountInfo });
      expect(selectAccountInfo(state)).toEqual(mockAccountInfo);
    });

    it('should select wallet address', () => {
      const state = createMockState({ accountInfo: mockAccountInfo });
      expect(selectWalletAddress(state)).toBe('0.0.123456');
    });

    it('should return null for wallet address when no account info', () => {
      const state = createMockState();
      expect(selectWalletAddress(state)).toBeNull();
    });

    it('should select wallet balance', () => {
      const state = createMockState({ accountInfo: mockAccountInfo });
      expect(selectWalletBalance(state)).toBe('100.5');
    });

    it('should return "0" for wallet balance when no account info', () => {
      const state = createMockState();
      expect(selectWalletBalance(state)).toBe('0');
    });

    it('should select wallet network', () => {
      const state = createMockState({ accountInfo: mockAccountInfo });
      expect(selectWalletNetwork(state)).toBe('testnet');
    });

    it('should return null for wallet network when no account info', () => {
      const state = createMockState();
      expect(selectWalletNetwork(state)).toBeNull();
    });
  });

  describe('provider management selectors', () => {
    it('should select available providers', () => {
      const providers = ['hashpack', 'blade'];
      const state = createMockState({ availableProviders: providers });
      expect(selectAvailableProviders(state)).toEqual(providers);
    });

    it('should check if has available providers', () => {
      const state = createMockState({ availableProviders: ['hashpack'] });
      expect(selectHasAvailableProviders(state)).toBe(true);
    });

    it('should return false when no available providers', () => {
      const state = createMockState({ availableProviders: [] });
      expect(selectHasAvailableProviders(state)).toBe(false);
    });

    it('should check if specific provider is available', () => {
      const state = createMockState({
        availableProviders: ['hashpack', 'blade'],
      });
      expect(selectIsProviderAvailable(state, 'hashpack')).toBe(true);
      expect(selectIsProviderAvailable(state, 'metamask')).toBe(false);
    });
  });

  describe('error handling selectors', () => {
    it('should select wallet error', () => {
      const state = createMockState({ error: mockError });
      expect(selectWalletError(state)).toEqual(mockError);
    });

    it('should check if has wallet error', () => {
      const state = createMockState({ error: mockError });
      expect(selectHasWalletError(state)).toBe(true);
    });

    it('should return false when no error', () => {
      const state = createMockState();
      expect(selectHasWalletError(state)).toBe(false);
    });

    it('should select wallet error type', () => {
      const state = createMockState({ error: mockError });
      expect(selectWalletErrorType(state)).toBe(
        WalletErrorType.CONNECTION_REJECTED
      );
    });

    it('should select wallet error message', () => {
      const state = createMockState({ error: mockError });
      expect(selectWalletErrorMessage(state)).toBe(
        'User rejected the connection request'
      );
    });

    it('should return null for error type when no error', () => {
      const state = createMockState();
      expect(selectWalletErrorType(state)).toBeNull();
    });
  });

  describe('connection status checks', () => {
    it('should check if connecting', () => {
      const state = createMockState({ connectionStatus: 'connecting' });
      expect(selectIsConnecting(state)).toBe(true);
    });

    it('should check if connected', () => {
      const state = createMockState({ connectionStatus: 'connected' });
      expect(selectIsConnected(state)).toBe(true);
    });

    it('should check if idle', () => {
      const state = createMockState({ connectionStatus: 'idle' });
      expect(selectIsIdle(state)).toBe(true);
    });

    it('should check if has connection error', () => {
      const state = createMockState({ connectionStatus: 'error' });
      expect(selectHasConnectionError(state)).toBe(true);
    });
  });

  describe('preferences selectors', () => {
    it('should select wallet preferences', () => {
      const preferences = { lastUsedProvider: 'hashpack', autoConnect: true };
      const state = createMockState({ preferences });
      expect(selectWalletPreferences(state)).toEqual(preferences);
    });

    it('should select last used provider', () => {
      const state = createMockState({
        preferences: { lastUsedProvider: 'hashpack', autoConnect: false },
      });
      expect(selectLastUsedProvider(state)).toBe('hashpack');
    });

    it('should select auto connect setting', () => {
      const state = createMockState({
        preferences: { lastUsedProvider: null, autoConnect: true },
      });
      expect(selectAutoConnect(state)).toBe(true);
    });
  });

  describe('computed selectors', () => {
    it('should truncate long wallet address', () => {
      const longAddress = '0.0.1234567890123456';
      const state = createMockState({
        accountInfo: { ...mockAccountInfo, accountId: longAddress },
      });
      expect(selectTruncatedWalletAddress(state)).toBe('0.0.12...3456');
    });

    it('should return short address as-is', () => {
      const shortAddress = '0.0.123';
      const state = createMockState({
        accountInfo: { ...mockAccountInfo, accountId: shortAddress },
      });
      expect(selectTruncatedWalletAddress(state)).toBe('0.0.123');
    });

    it('should return null for truncated address when no account', () => {
      const state = createMockState();
      expect(selectTruncatedWalletAddress(state)).toBeNull();
    });

    it('should check if can connect', () => {
      const state = createMockState({
        connectionStatus: 'idle',
        availableProviders: ['hashpack'],
      });
      expect(selectCanConnect(state)).toBe(true);
    });

    it('should return false for can connect when connecting', () => {
      const state = createMockState({
        connectionStatus: 'connecting',
        availableProviders: ['hashpack'],
      });
      expect(selectCanConnect(state)).toBe(false);
    });

    it('should check if can disconnect', () => {
      const state = createMockState({ isConnected: true });
      expect(selectCanDisconnect(state)).toBe(true);
    });

    it('should check if should show connect button', () => {
      const state = createMockState({
        isConnected: false,
        connectionStatus: 'idle',
      });
      expect(selectShouldShowConnectButton(state)).toBe(true);
    });

    it('should check if should show wallet info', () => {
      const state = createMockState({
        isConnected: true,
        accountInfo: mockAccountInfo,
      });
      expect(selectShouldShowWalletInfo(state)).toBe(true);
    });
  });

  describe('error type specific selectors', () => {
    it('should check for provider not found error', () => {
      const error = { ...mockError, type: WalletErrorType.PROVIDER_NOT_FOUND };
      const state = createMockState({ error });
      expect(selectIsProviderNotFoundError(state)).toBe(true);
    });

    it('should check for connection rejected error', () => {
      const state = createMockState({ error: mockError });
      expect(selectIsConnectionRejectedError(state)).toBe(true);
    });

    it('should check for wallet locked error', () => {
      const error = { ...mockError, type: WalletErrorType.WALLET_LOCKED };
      const state = createMockState({ error });
      expect(selectIsWalletLockedError(state)).toBe(true);
    });

    it('should check for wrong network error', () => {
      const error = { ...mockError, type: WalletErrorType.WRONG_NETWORK };
      const state = createMockState({ error });
      expect(selectIsWrongNetworkError(state)).toBe(true);
    });

    it('should check for network error', () => {
      const error = { ...mockError, type: WalletErrorType.NETWORK_ERROR };
      const state = createMockState({ error });
      expect(selectIsNetworkError(state)).toBe(true);
    });
  });

  describe('validation selectors', () => {
    it('should check if can retry connection for network error', () => {
      const error = { ...mockError, type: WalletErrorType.NETWORK_ERROR };
      const state = createMockState({
        error,
        availableProviders: ['hashpack'],
        preferences: { lastUsedProvider: 'hashpack', autoConnect: false },
      });
      expect(selectCanRetryConnection(state)).toBe(true);
    });

    it('should return false for retry when provider not available', () => {
      const error = { ...mockError, type: WalletErrorType.NETWORK_ERROR };
      const state = createMockState({
        error,
        availableProviders: ['blade'],
        preferences: { lastUsedProvider: 'hashpack', autoConnect: false },
      });
      expect(selectCanRetryConnection(state)).toBe(false);
    });

    it('should check if needs provider installation', () => {
      const error = { ...mockError, type: WalletErrorType.PROVIDER_NOT_FOUND };
      const state = createMockState({ error });
      expect(selectNeedsProviderInstallation(state)).toBe(true);
    });

    it('should check if needs network switch', () => {
      const error = { ...mockError, type: WalletErrorType.WRONG_NETWORK };
      const state = createMockState({ error });
      expect(selectNeedsNetworkSwitch(state)).toBe(true);
    });

    it('should check if should attempt auto connect', () => {
      const state = createMockState({
        connectionStatus: 'idle',
        isConnected: false,
        availableProviders: ['hashpack'],
        preferences: { lastUsedProvider: 'hashpack', autoConnect: true },
      });
      expect(selectShouldAttemptAutoConnect(state)).toBe(true);
    });

    it('should return false for auto connect when already connected', () => {
      const state = createMockState({
        connectionStatus: 'connected',
        isConnected: true,
        availableProviders: ['hashpack'],
        preferences: { lastUsedProvider: 'hashpack', autoConnect: true },
      });
      expect(selectShouldAttemptAutoConnect(state)).toBe(false);
    });
  });

  describe('UI state selectors', () => {
    it('should select wallet UI state', () => {
      const state = createMockState({
        isConnected: true,
        connectionStatus: 'connected',
        error: null,
        accountInfo: mockAccountInfo,
        availableProviders: ['hashpack', 'blade'],
      });

      const uiState = selectWalletUIState(state);
      expect(uiState).toEqual({
        isConnected: true,
        status: 'connected',
        error: null,
        accountInfo: mockAccountInfo,
        hasProviders: true,
        showConnectButton: false,
        showWalletInfo: true,
        showError: false,
        showLoading: false,
      });
    });

    it('should select wallet statistics', () => {
      const state = createMockState({
        isConnected: true,
        currentProvider: 'hashpack',
        availableProviders: ['hashpack', 'blade'],
        preferences: { lastUsedProvider: 'hashpack', autoConnect: true },
      });

      const stats = selectWalletStatistics(state);
      expect(stats).toEqual({
        totalProviders: 2,
        hasConnection: true,
        currentProvider: 'hashpack',
        hasStoredPreferences: true,
        autoConnectEnabled: true,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty state gracefully', () => {
      const state = createMockState();

      expect(selectWalletAddress(state)).toBeNull();
      expect(selectWalletBalance(state)).toBe('0');
      expect(selectWalletNetwork(state)).toBeNull();
      expect(selectHasAvailableProviders(state)).toBe(false);
      expect(selectHasWalletError(state)).toBe(false);
      expect(selectCanConnect(state)).toBe(false);
      expect(selectShouldAttemptAutoConnect(state)).toBe(false);
    });

    it('should handle partial account info', () => {
      const partialAccountInfo = {
        accountId: '0.0.123456',
        balance: '',
        network: 'testnet' as const,
      };

      const state = createMockState({ accountInfo: partialAccountInfo });
      expect(selectWalletBalance(state)).toBe('0'); // Selector returns '0' for falsy balance
      expect(selectWalletAddress(state)).toBe('0.0.123456');
    });

    it('should handle malformed error gracefully', () => {
      const malformedError = { type: 'INVALID_TYPE' as any, message: '' };
      const state = createMockState({ error: malformedError });

      expect(selectHasWalletError(state)).toBe(true);
      expect(selectWalletErrorMessage(state)).toBeNull(); // Empty string is falsy, so selector returns null
      expect(selectIsProviderNotFoundError(state)).toBe(false);
    });
  });
});
