import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WalletContextProvider } from '@/contexts/WalletContext';
import { WalletConnectButton } from '../WalletConnectButton';
import { walletSlice } from '@/store/slices/walletSlice';
import { walletService } from '@/services/wallet/WalletService';
import { AccountInfo, WalletConnection } from '@/types/wallet';

// Mock the wallet service
vi.mock('@/services/wallet/WalletService', () => ({
  walletService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getAccountInfo: vi.fn(),
    getBalance: vi.fn(),
    getAvailableProviders: vi.fn(),
    isConnected: vi.fn(),
    restoreConnection: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

const mockWalletService = walletService as any;

const createTestStore = (initialState?: any) => {
  return configureStore({
    reducer: {
      wallet: walletSlice.reducer,
    },
    preloadedState: initialState,
  });
};

const renderWithProvider = (component: React.ReactElement, store: any) => {
  return render(
    <Provider store={store}>
      <WalletContextProvider>{component}</WalletContextProvider>
    </Provider>
  );
};

describe('Wallet Disconnect Flow Integration', () => {
  const mockAccountInfo: AccountInfo = {
    accountId: '0.0.123456789',
    balance: '1000.50',
    network: 'mainnet',
  };

  const mockConnection: WalletConnection = {
    accountId: '0.0.123456789',
    network: 'mainnet',
    isConnected: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
    mockWalletService.disconnect.mockResolvedValue();
  });

  it('should perform complete disconnect flow from connected state', async () => {
    // Start with connected state
    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
        error: null,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      },
    };

    const store = createTestStore(connectedState);
    renderWithProvider(<WalletConnectButton />, store);

    // Verify connected state UI
    expect(screen.getByText('0.0.12...6789')).toBeInTheDocument();
    expect(screen.getByText('1000.50 HBAR')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /disconnect/i })
    ).toBeInTheDocument();

    // Click disconnect button
    const disconnectButton = screen.getByRole('button', {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectButton);

    // Wait for disconnect to complete
    await waitFor(() => {
      expect(mockWalletService.disconnect).toHaveBeenCalledOnce();
    });

    // Verify state after disconnect
    const finalState = store.getState();
    expect(finalState.wallet.isConnected).toBe(false);
    expect(finalState.wallet.currentProvider).toBeNull();
    expect(finalState.wallet.accountInfo).toBeNull();
    expect(finalState.wallet.connectionStatus).toBe('idle');
    expect(finalState.wallet.error).toBeNull();
  });

  it('should handle disconnect errors gracefully', async () => {
    const disconnectError = new Error('Disconnect failed');
    mockWalletService.disconnect.mockRejectedValue(disconnectError);

    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
        error: null,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      },
    };

    const store = createTestStore(connectedState);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    renderWithProvider(<WalletConnectButton />, store);

    // Click disconnect button
    const disconnectButton = screen.getByRole('button', {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockWalletService.disconnect).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to disconnect wallet:',
        disconnectError
      );
    });

    // Verify error state
    const finalState = store.getState();
    expect(finalState.wallet.error).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  it('should return to initial connect wallet state after disconnect', async () => {
    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
        error: null,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      },
    };

    const store = createTestStore(connectedState);
    renderWithProvider(<WalletConnectButton />, store);

    // Verify connected state
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /disconnect/i })
    ).toBeInTheDocument();

    // Disconnect
    const disconnectButton = screen.getByRole('button', {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockWalletService.disconnect).toHaveBeenCalledOnce();
    });

    // Verify UI returns to initial state
    const finalState = store.getState();
    expect(finalState.wallet.isConnected).toBe(false);
    expect(finalState.wallet.connectionStatus).toBe('idle');
  });

  it('should clear cached balance and account information on disconnect', async () => {
    const stateWithCachedData = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456789',
          balance: '1000.50',
          network: 'mainnet' as const,
        },
        connectionStatus: 'connected' as const,
        error: null,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      },
    };

    const store = createTestStore(stateWithCachedData);
    renderWithProvider(<WalletConnectButton />, store);

    // Verify cached data is displayed
    expect(screen.getByText('0.0.12...6789')).toBeInTheDocument();
    expect(screen.getByText('1000.50 HBAR')).toBeInTheDocument();

    // Disconnect
    const disconnectButton = screen.getByRole('button', {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockWalletService.disconnect).toHaveBeenCalledOnce();
    });

    // Verify all cached data is cleared
    const finalState = store.getState();
    expect(finalState.wallet.accountInfo).toBeNull();
    expect(finalState.wallet.isConnected).toBe(false);
    expect(finalState.wallet.currentProvider).toBeNull();
  });

  it('should preserve non-session data during disconnect', async () => {
    const stateWithPreferences = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: mockAccountInfo,
        connectionStatus: 'connected' as const,
        error: null,
        availableProviders: ['hashpack', 'blade'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        },
      },
    };

    const store = createTestStore(stateWithPreferences);
    renderWithProvider(<WalletConnectButton />, store);

    // Disconnect
    const disconnectButton = screen.getByRole('button', {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockWalletService.disconnect).toHaveBeenCalledOnce();
    });

    // Verify non-session data is preserved
    const finalState = store.getState();
    expect(finalState.wallet.availableProviders).toEqual(['hashpack', 'blade']);
    expect(finalState.wallet.preferences.lastUsedProvider).toBe('hashpack');
    expect(finalState.wallet.preferences.autoConnect).toBe(true);
  });
});
