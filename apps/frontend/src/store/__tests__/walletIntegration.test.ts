import { describe, it, expect } from 'vitest';
import { store } from '../index';
import {
  connectWalletStart,
  connectWalletSuccess,
  disconnectWallet,
  setAvailableProviders,
} from '../slices/walletSlice';
import {
  selectIsWalletConnected,
  selectCurrentProvider,
  selectAvailableProviders,
  selectAccountInfo,
  selectConnectionStatus,
  selectWalletError,
} from '../selectors/walletSelectors';
import { AccountInfo, WalletConnection } from '../../types/wallet';

describe('Wallet Redux Integration', () => {
  it('should integrate wallet slice with store and selectors', () => {
    // Initial state
    expect(selectIsWalletConnected(store.getState())).toBe(false);
    expect(selectCurrentProvider(store.getState())).toBeNull();
    expect(selectAvailableProviders(store.getState())).toEqual([]);

    // Set available providers
    store.dispatch(setAvailableProviders(['hashpack', 'blade']));
    expect(selectAvailableProviders(store.getState())).toEqual([
      'hashpack',
      'blade',
    ]);

    // Start connection
    store.dispatch(connectWalletStart('hashpack'));
    expect(selectCurrentProvider(store.getState())).toBe('hashpack');
    expect(selectIsWalletConnected(store.getState())).toBe(false);

    // Complete connection
    const mockConnection: WalletConnection = {
      accountId: '0.0.123456',
      network: 'testnet',
      isConnected: true,
    };

    const mockAccountInfo: AccountInfo = {
      accountId: '0.0.123456',
      balance: '100.5',
      network: 'testnet',
    };

    store.dispatch(
      connectWalletSuccess({
        connection: mockConnection,
        accountInfo: mockAccountInfo,
        provider: 'hashpack',
      })
    );

    expect(selectIsWalletConnected(store.getState())).toBe(true);
    expect(selectCurrentProvider(store.getState())).toBe('hashpack');
  });

  it('should handle complete disconnect flow', () => {
    // First establish a connection
    const mockConnection: WalletConnection = {
      accountId: '0.0.123456',
      network: 'testnet',
      isConnected: true,
    };

    const mockAccountInfo: AccountInfo = {
      accountId: '0.0.123456',
      balance: '100.5',
      network: 'testnet',
    };

    store.dispatch(connectWalletStart('hashpack'));
    store.dispatch(
      connectWalletSuccess({
        connection: mockConnection,
        accountInfo: mockAccountInfo,
        provider: 'hashpack',
      })
    );

    // Verify connected state
    expect(selectIsWalletConnected(store.getState())).toBe(true);
    expect(selectCurrentProvider(store.getState())).toBe('hashpack');
    expect(selectAccountInfo(store.getState())).toEqual(mockAccountInfo);
    expect(selectConnectionStatus(store.getState())).toBe('connected');

    // Disconnect
    store.dispatch(disconnectWallet());

    // Verify disconnected state - all session data should be cleared
    expect(selectIsWalletConnected(store.getState())).toBe(false);
    expect(selectCurrentProvider(store.getState())).toBeNull();
    expect(selectAccountInfo(store.getState())).toBeNull();
    expect(selectConnectionStatus(store.getState())).toBe('idle');
    expect(selectWalletError(store.getState())).toBeNull();
  });

  it('should maintain type safety with RootState', () => {
    const state = store.getState();

    // Verify wallet state is properly typed
    expect(state.wallet).toBeDefined();
    expect(typeof state.wallet.isConnected).toBe('boolean');
    expect(Array.isArray(state.wallet.availableProviders)).toBe(true);
    expect(typeof state.wallet.connectionStatus).toBe('string');
  });
});
