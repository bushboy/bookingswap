import { describe, it, expect, beforeEach } from 'vitest';
import {
  walletSlice,
  connectWalletStart,
  connectWalletSuccess,
  connectWalletFailure,
  disconnectWallet,
  updateAccountInfo,
  updateBalance,
  setAvailableProviders,
  addAvailableProvider,
  removeAvailableProvider,
  setError,
  clearError,
  setPreferences,
  setAutoConnect,
  resetWalletState,
  setConnectionStatus,
} from '../walletSlice';
import {
  WalletErrorType,
  AccountInfo,
  WalletConnection,
  WalletError,
} from '../../../types/wallet';

describe('walletSlice', () => {
  const initialState = {
    isConnected: false,
    currentProvider: null,
    accountInfo: null,
    connectionStatus: 'idle' as const,
    error: null,
    availableProviders: [],
    preferences: {
      lastUsedProvider: null,
      autoConnect: false,
    },
  };

  const mockAccountInfo: AccountInfo = {
    accountId: '0.0.123456',
    balance: '100.5',
    network: 'testnet',
  };

  const mockConnection: WalletConnection = {
    accountId: '0.0.123456',
    network: 'testnet',
    isConnected: true,
  };

  const mockError: WalletError = {
    type: WalletErrorType.CONNECTION_REJECTED,
    message: 'User rejected the connection request',
  };

  beforeEach(() => {
    // Reset any test state if needed
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = walletSlice.reducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });
  });

  describe('connection lifecycle actions', () => {
    it('should handle setConnectionStatus', () => {
      const state = walletSlice.reducer(
        initialState,
        setConnectionStatus('connecting')
      );
      expect(state.connectionStatus).toBe('connecting');
      expect(state.error).toBeNull();
    });

    it('should handle connectWalletStart', () => {
      const state = walletSlice.reducer(
        initialState,
        connectWalletStart('hashpack')
      );
      expect(state.connectionStatus).toBe('connecting');
      expect(state.currentProvider).toBe('hashpack');
      expect(state.error).toBeNull();
    });

    it('should handle connectWalletSuccess', () => {
      const payload = {
        connection: mockConnection,
        accountInfo: mockAccountInfo,
        provider: 'hashpack',
      };

      const state = walletSlice.reducer(
        initialState,
        connectWalletSuccess(payload)
      );

      expect(state.isConnected).toBe(true);
      expect(state.currentProvider).toBe('hashpack');
      expect(state.accountInfo).toEqual(mockAccountInfo);
      expect(state.connectionStatus).toBe('connected');
      expect(state.error).toBeNull();
      expect(state.preferences.lastUsedProvider).toBe('hashpack');
    });

    it('should handle connectWalletFailure', () => {
      const connectedState = {
        ...initialState,
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
      };

      const state = walletSlice.reducer(
        connectedState,
        connectWalletFailure(mockError)
      );

      expect(state.isConnected).toBe(false);
      expect(state.currentProvider).toBeNull();
      expect(state.accountInfo).toBeNull();
      expect(state.connectionStatus).toBe('error');
      expect(state.error).toEqual(mockError);
    });

    it('should handle disconnectWallet', () => {
      const connectedState = {
        ...initialState,
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
        error: mockError,
      };

      const state = walletSlice.reducer(connectedState, disconnectWallet());

      expect(state.isConnected).toBe(false);
      expect(state.currentProvider).toBeNull();
      expect(state.accountInfo).toBeNull();
      expect(state.connectionStatus).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('should clear all session data on disconnect', () => {
      const fullyConnectedState = {
        ...initialState,
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456',
          balance: '1000.50',
          network: 'mainnet' as const,
        },
        connectionStatus: 'connected' as const,
        error: {
          type: WalletErrorType.NETWORK_ERROR,
          message: 'Previous error',
        } as WalletError,
        availableProviders: ['hashpack', 'blade'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      };

      const state = walletSlice.reducer(
        fullyConnectedState,
        disconnectWallet()
      );

      // Verify all session data is cleared
      expect(state.isConnected).toBe(false);
      expect(state.currentProvider).toBeNull();
      expect(state.accountInfo).toBeNull();
      expect(state.connectionStatus).toBe('idle');
      expect(state.error).toBeNull();

      // Verify non-session data is preserved
      expect(state.availableProviders).toEqual(['hashpack', 'blade']);
      expect(state.preferences.lastUsedProvider).toBe('hashpack'); // Preferences should be preserved
      expect(state.preferences.autoConnect).toBe(true);
    });
  });

  describe('account info updates', () => {
    it('should handle updateAccountInfo', () => {
      const newAccountInfo: AccountInfo = {
        accountId: '0.0.789012',
        balance: '200.75',
        network: 'mainnet',
      };

      const state = walletSlice.reducer(
        { ...initialState, accountInfo: mockAccountInfo },
        updateAccountInfo(newAccountInfo)
      );

      expect(state.accountInfo).toEqual(newAccountInfo);
    });

    it('should handle updateBalance when accountInfo exists', () => {
      const stateWithAccount = {
        ...initialState,
        accountInfo: mockAccountInfo,
      };

      const state = walletSlice.reducer(
        stateWithAccount,
        updateBalance('250.25')
      );

      expect(state.accountInfo?.balance).toBe('250.25');
      expect(state.accountInfo?.accountId).toBe(mockAccountInfo.accountId);
      expect(state.accountInfo?.network).toBe(mockAccountInfo.network);
    });

    it('should not update balance when accountInfo is null', () => {
      const state = walletSlice.reducer(initialState, updateBalance('250.25'));
      expect(state.accountInfo).toBeNull();
    });
  });

  describe('provider management', () => {
    it('should handle setAvailableProviders', () => {
      const providers = ['hashpack', 'blade', 'metamask'];
      const state = walletSlice.reducer(
        initialState,
        setAvailableProviders(providers)
      );
      expect(state.availableProviders).toEqual(providers);
    });

    it('should handle addAvailableProvider', () => {
      const stateWithProviders = {
        ...initialState,
        availableProviders: ['hashpack'],
      };

      const state = walletSlice.reducer(
        stateWithProviders,
        addAvailableProvider('blade')
      );
      expect(state.availableProviders).toEqual(['hashpack', 'blade']);
    });

    it('should not add duplicate provider', () => {
      const stateWithProviders = {
        ...initialState,
        availableProviders: ['hashpack', 'blade'],
      };

      const state = walletSlice.reducer(
        stateWithProviders,
        addAvailableProvider('hashpack')
      );
      expect(state.availableProviders).toEqual(['hashpack', 'blade']);
    });

    it('should handle removeAvailableProvider', () => {
      const stateWithProviders = {
        ...initialState,
        availableProviders: ['hashpack', 'blade', 'metamask'],
      };

      const state = walletSlice.reducer(
        stateWithProviders,
        removeAvailableProvider('blade')
      );
      expect(state.availableProviders).toEqual(['hashpack', 'metamask']);
    });
  });

  describe('error handling', () => {
    it('should handle setError', () => {
      const state = walletSlice.reducer(initialState, setError(mockError));
      expect(state.error).toEqual(mockError);
      expect(state.connectionStatus).toBe('error');
    });

    it('should handle setError with null', () => {
      const stateWithError = {
        ...initialState,
        error: mockError,
        connectionStatus: 'error' as const,
      };

      const state = walletSlice.reducer(stateWithError, setError(null));
      expect(state.error).toBeNull();
    });

    it('should handle clearError when status is error and not connected', () => {
      const stateWithError = {
        ...initialState,
        error: mockError,
        connectionStatus: 'error' as const,
        isConnected: false,
      };

      const state = walletSlice.reducer(stateWithError, clearError());
      expect(state.error).toBeNull();
      expect(state.connectionStatus).toBe('idle');
    });

    it('should handle clearError when status is error and connected', () => {
      const stateWithError = {
        ...initialState,
        error: mockError,
        connectionStatus: 'error' as const,
        isConnected: true,
      };

      const state = walletSlice.reducer(stateWithError, clearError());
      expect(state.error).toBeNull();
      expect(state.connectionStatus).toBe('connected');
    });
  });

  describe('preferences', () => {
    it('should handle setPreferences', () => {
      const newPreferences = {
        lastUsedProvider: 'hashpack',
        autoConnect: true,
      };

      const state = walletSlice.reducer(
        initialState,
        setPreferences(newPreferences)
      );
      expect(state.preferences).toEqual(newPreferences);
    });

    it('should handle partial setPreferences', () => {
      const stateWithPrefs = {
        ...initialState,
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: false,
        },
      };

      const state = walletSlice.reducer(
        stateWithPrefs,
        setPreferences({ autoConnect: true })
      );
      expect(state.preferences).toEqual({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
      });
    });

    it('should handle setAutoConnect', () => {
      const state = walletSlice.reducer(initialState, setAutoConnect(true));
      expect(state.preferences.autoConnect).toBe(true);
      expect(state.preferences.lastUsedProvider).toBeNull();
    });
  });

  describe('reset state', () => {
    it('should handle resetWalletState', () => {
      const modifiedState = {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
        error: mockError,
        availableProviders: ['hashpack', 'blade'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      };

      const state = walletSlice.reducer(modifiedState, resetWalletState());
      expect(state).toEqual(initialState);
    });
  });

  describe('complex scenarios', () => {
    it('should handle connection flow from start to success', () => {
      let state = walletSlice.reducer(
        initialState,
        connectWalletStart('hashpack')
      );
      expect(state.connectionStatus).toBe('connecting');
      expect(state.currentProvider).toBe('hashpack');

      const payload = {
        connection: mockConnection,
        accountInfo: mockAccountInfo,
        provider: 'hashpack',
      };

      state = walletSlice.reducer(state, connectWalletSuccess(payload));
      expect(state.isConnected).toBe(true);
      expect(state.connectionStatus).toBe('connected');
      expect(state.accountInfo).toEqual(mockAccountInfo);
    });

    it('should handle connection flow from start to failure', () => {
      let state = walletSlice.reducer(
        initialState,
        connectWalletStart('hashpack')
      );
      expect(state.connectionStatus).toBe('connecting');

      state = walletSlice.reducer(state, connectWalletFailure(mockError));
      expect(state.isConnected).toBe(false);
      expect(state.connectionStatus).toBe('error');
      expect(state.error).toEqual(mockError);
    });

    it('should handle provider management during connection', () => {
      let state = walletSlice.reducer(
        initialState,
        setAvailableProviders(['hashpack', 'blade'])
      );
      expect(state.availableProviders).toEqual(['hashpack', 'blade']);

      state = walletSlice.reducer(state, connectWalletStart('hashpack'));
      expect(state.currentProvider).toBe('hashpack');

      // Provider list should remain unchanged during connection
      expect(state.availableProviders).toEqual(['hashpack', 'blade']);
    });

    it('should maintain preferences across connection cycles', () => {
      let state = walletSlice.reducer(
        initialState,
        setPreferences({
          lastUsedProvider: 'blade',
          autoConnect: true,
        })
      );

      const payload = {
        connection: mockConnection,
        accountInfo: mockAccountInfo,
        provider: 'hashpack',
      };

      state = walletSlice.reducer(state, connectWalletSuccess(payload));
      expect(state.preferences.lastUsedProvider).toBe('hashpack'); // Updated to current
      expect(state.preferences.autoConnect).toBe(true); // Preserved

      state = walletSlice.reducer(state, disconnectWallet());
      expect(state.preferences.lastUsedProvider).toBe('hashpack'); // Preserved
      expect(state.preferences.autoConnect).toBe(true); // Preserved
    });
  });
});
