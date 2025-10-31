import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WalletContextProvider, useWalletContext } from '../WalletContext';
import { walletSlice } from '@/store/slices/walletSlice';
import { walletService } from '@/services/wallet/WalletService';
import {
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
} from '@/types/wallet';

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
    saveAccountInfo: vi.fn(),
    loadAccountInfo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

const mockWalletService = walletService as any;

// Test component that uses the wallet context
const TestComponent: React.FC = () => {
  const {
    connect,
    disconnect,
    refreshAccountInfo,
    refreshBalance,
    refreshAvailableProviders,
    clearWalletError,
    isConnected,
    connectionStatus,
    currentProvider,
    accountInfo,
    error,
    availableProviders,
  } = useWalletContext();

  return (
    <div>
      <div data-testid="connection-status">{connectionStatus}</div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="current-provider">{currentProvider || 'none'}</div>
      <div data-testid="account-id">{accountInfo?.accountId || 'none'}</div>
      <div data-testid="balance">{accountInfo?.balance || '0'}</div>
      <div data-testid="error">{error?.message || 'none'}</div>
      <div data-testid="available-providers">
        {availableProviders.join(',')}
      </div>

      <button onClick={() => connect('hashpack')} data-testid="connect-btn">
        Connect
      </button>
      <button onClick={() => disconnect()} data-testid="disconnect-btn">
        Disconnect
      </button>
      <button
        onClick={() => refreshAccountInfo()}
        data-testid="refresh-account-btn"
      >
        Refresh Account
      </button>
      <button
        onClick={() => refreshBalance()}
        data-testid="refresh-balance-btn"
      >
        Refresh Balance
      </button>
      <button
        onClick={() => refreshAvailableProviders()}
        data-testid="refresh-providers-btn"
      >
        Refresh Providers
      </button>
      <button onClick={() => clearWalletError()} data-testid="clear-error-btn">
        Clear Error
      </button>
    </div>
  );
};

const createTestStore = () => {
  return configureStore({
    reducer: {
      wallet: walletSlice.reducer,
    },
  });
};

const renderWithProvider = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <WalletContextProvider>{component}</WalletContextProvider>
    </Provider>
  );
};

describe('WalletContextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([
      {
        id: 'hashpack',
        name: 'HashPack',
        icon: '',
        isAvailable: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        getAccountInfo: vi.fn(),
        getBalance: vi.fn(),
      },
    ]);
  });

  it('should provide wallet context to children', () => {
    renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('connection-status')).toHaveTextContent('idle');
    expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
    expect(screen.getByTestId('current-provider')).toHaveTextContent('none');
  });

  it('should throw error when used outside provider', () => {
    const TestComponentWithoutProvider = () => {
      useWalletContext();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponentWithoutProvider />)).toThrow(
      'useWalletContext must be used within a WalletContextProvider'
    );

    consoleSpy.mockRestore();
  });

  it('should initialize available providers on mount', async () => {
    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(mockWalletService.getAvailableProviders).toHaveBeenCalled();
    });
  });

  it('should handle wallet connection successfully', async () => {
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

    mockWalletService.connect.mockResolvedValue(mockConnection);
    mockWalletService.getAccountInfo.mockResolvedValue(mockAccountInfo);

    renderWithProvider(<TestComponent />);

    const connectBtn = screen.getByTestId('connect-btn');

    await act(async () => {
      connectBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('current-provider')).toHaveTextContent(
        'hashpack'
      );
      expect(screen.getByTestId('account-id')).toHaveTextContent('0.0.123456');
      expect(screen.getByTestId('balance')).toHaveTextContent('100.5');
    });

    expect(mockWalletService.connect).toHaveBeenCalledWith('hashpack');
    expect(mockWalletService.getAccountInfo).toHaveBeenCalled();
  });

  it('should handle wallet connection failure', async () => {
    const mockError: WalletError = {
      type: WalletErrorType.CONNECTION_REJECTED,
      message: 'User rejected connection',
    };

    mockWalletService.connect.mockRejectedValue(mockError);

    renderWithProvider(<TestComponent />);

    const connectBtn = screen.getByTestId('connect-btn');

    await act(async () => {
      connectBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'error'
      );
      expect(screen.getByTestId('error')).toHaveTextContent(
        'User rejected connection'
      );
    });
  });

  it('should handle wallet disconnection', async () => {
    // First connect
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

    mockWalletService.connect.mockResolvedValue(mockConnection);
    mockWalletService.getAccountInfo.mockResolvedValue(mockAccountInfo);
    mockWalletService.disconnect.mockResolvedValue();

    renderWithProvider(<TestComponent />);

    // Connect first
    const connectBtn = screen.getByTestId('connect-btn');
    await act(async () => {
      connectBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
    });

    // Then disconnect
    const disconnectBtn = screen.getByTestId('disconnect-btn');
    await act(async () => {
      disconnectBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('current-provider')).toHaveTextContent('none');
      expect(screen.getByTestId('connection-status')).toHaveTextContent('idle');
    });

    expect(mockWalletService.disconnect).toHaveBeenCalled();
  });

  it('should refresh account info when connected', async () => {
    const mockAccountInfo: AccountInfo = {
      accountId: '0.0.123456',
      balance: '200.5',
      network: 'testnet',
    };

    mockWalletService.isConnected.mockReturnValue(true);
    mockWalletService.getAccountInfo.mockResolvedValue(mockAccountInfo);

    renderWithProvider(<TestComponent />);

    const refreshBtn = screen.getByTestId('refresh-account-btn');

    await act(async () => {
      refreshBtn.click();
    });

    await waitFor(() => {
      expect(mockWalletService.getAccountInfo).toHaveBeenCalled();
    });
  });

  it('should refresh balance when connected', async () => {
    mockWalletService.isConnected.mockReturnValue(true);
    mockWalletService.getBalance.mockResolvedValue('150.75');

    renderWithProvider(<TestComponent />);

    const refreshBtn = screen.getByTestId('refresh-balance-btn');

    await act(async () => {
      refreshBtn.click();
    });

    await waitFor(() => {
      expect(mockWalletService.getBalance).toHaveBeenCalled();
    });
  });

  it('should not refresh account info when not connected', async () => {
    mockWalletService.isConnected.mockReturnValue(false);

    renderWithProvider(<TestComponent />);

    const refreshBtn = screen.getByTestId('refresh-account-btn');

    await act(async () => {
      refreshBtn.click();
    });

    // Should not call getAccountInfo when not connected
    expect(mockWalletService.getAccountInfo).not.toHaveBeenCalled();
  });

  it('should refresh available providers', async () => {
    const mockProviders = [
      {
        id: 'hashpack',
        name: 'HashPack',
        icon: '',
        isAvailable: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        getAccountInfo: vi.fn(),
        getBalance: vi.fn(),
      },
      {
        id: 'blade',
        name: 'Blade',
        icon: '',
        isAvailable: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        getAccountInfo: vi.fn(),
        getBalance: vi.fn(),
      },
    ];

    mockWalletService.getAvailableProviders.mockResolvedValue(mockProviders);

    renderWithProvider(<TestComponent />);

    const refreshBtn = screen.getByTestId('refresh-providers-btn');

    await act(async () => {
      refreshBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('available-providers')).toHaveTextContent(
        'hashpack,blade'
      );
    });
  });

  it('should clear wallet error', async () => {
    renderWithProvider(<TestComponent />);

    const clearErrorBtn = screen.getByTestId('clear-error-btn');

    await act(async () => {
      clearErrorBtn.click();
    });

    // Should not throw and should clear any existing error
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('should set up and clean up event listeners', () => {
    const { unmount } = renderWithProvider(<TestComponent />);

    // Should have set up event listeners
    expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
      'connect',
      expect.any(Function)
    );
    expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function)
    );
    expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
      'accountChanged',
      expect.any(Function)
    );
    expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
      'networkChanged',
      expect.any(Function)
    );
    expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );

    unmount();

    // Should have cleaned up event listeners
    expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
      'connect',
      expect.any(Function)
    );
    expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function)
    );
    expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
      'accountChanged',
      expect.any(Function)
    );
    expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
      'networkChanged',
      expect.any(Function)
    );
    expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
  });

  it('should attempt connection restoration on mount', async () => {
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

    mockWalletService.restoreConnection.mockResolvedValue(mockConnection);
    mockWalletService.getAccountInfo.mockResolvedValue(mockAccountInfo);

    // Mock the selector to return true for auto-connect
    const store = configureStore({
      reducer: {
        wallet: walletSlice.reducer,
      },
      preloadedState: {
        wallet: {
          isConnected: false,
          currentProvider: null,
          accountInfo: null,
          connectionStatus: 'idle',
          error: null,
          availableProviders: ['hashpack'],
          preferences: {
            lastUsedProvider: 'hashpack',
            autoConnect: true,
          },
        },
      },
    });

    render(
      <Provider store={store}>
        <WalletContextProvider>
          <TestComponent />
        </WalletContextProvider>
      </Provider>
    );

    // Wait for the restoration attempt (with 1 second delay)
    await waitFor(
      () => {
        expect(mockWalletService.restoreConnection).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  describe('Persistence Integration', () => {
    it('should save account info after successful connection', async () => {
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

      mockWalletService.connect.mockResolvedValue(mockConnection);
      mockWalletService.getAccountInfo.mockResolvedValue(mockAccountInfo);

      renderWithProvider(<TestComponent />);

      const connectBtn = screen.getByTestId('connect-btn');

      await act(async () => {
        connectBtn.click();
      });

      await waitFor(() => {
        expect(mockWalletService.saveAccountInfo).toHaveBeenCalledWith(
          mockAccountInfo
        );
      });
    });

    it('should save account info after refresh', async () => {
      const mockAccountInfo: AccountInfo = {
        accountId: '0.0.123456',
        balance: '200.5',
        network: 'testnet',
      };

      mockWalletService.isConnected.mockReturnValue(true);
      mockWalletService.getAccountInfo.mockResolvedValue(mockAccountInfo);

      renderWithProvider(<TestComponent />);

      const refreshBtn = screen.getByTestId('refresh-account-btn');

      await act(async () => {
        refreshBtn.click();
      });

      await waitFor(() => {
        expect(mockWalletService.saveAccountInfo).toHaveBeenCalledWith(
          mockAccountInfo
        );
      });
    });

    it('should use cached account info during restoration when available', async () => {
      const mockConnection: WalletConnection = {
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      };

      const cachedAccountInfo: AccountInfo = {
        accountId: '0.0.123456',
        balance: '100.5',
        network: 'testnet',
      };

      mockWalletService.restoreConnection.mockResolvedValue(mockConnection);
      mockWalletService.loadAccountInfo.mockReturnValue(cachedAccountInfo);

      // Mock the selector to return true for auto-connect
      const store = configureStore({
        reducer: {
          wallet: walletSlice.reducer,
        },
        preloadedState: {
          wallet: {
            isConnected: false,
            currentProvider: null,
            accountInfo: null,
            connectionStatus: 'idle',
            error: null,
            availableProviders: ['hashpack'],
            preferences: {
              lastUsedProvider: 'hashpack',
              autoConnect: true,
            },
          },
        },
      });

      render(
        <Provider store={store}>
          <WalletContextProvider>
            <TestComponent />
          </WalletContextProvider>
        </Provider>
      );

      // Wait for the restoration attempt
      await waitFor(
        () => {
          expect(mockWalletService.restoreConnection).toHaveBeenCalled();
          expect(mockWalletService.loadAccountInfo).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Should not fetch fresh account info since cached version exists
      expect(mockWalletService.getAccountInfo).not.toHaveBeenCalled();
    });

    it('should fetch fresh account info during restoration when cache is empty', async () => {
      const mockConnection: WalletConnection = {
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      };

      const freshAccountInfo: AccountInfo = {
        accountId: '0.0.123456',
        balance: '100.5',
        network: 'testnet',
      };

      mockWalletService.restoreConnection.mockResolvedValue(mockConnection);
      mockWalletService.loadAccountInfo.mockReturnValue(null); // No cached data
      mockWalletService.getAccountInfo.mockResolvedValue(freshAccountInfo);

      // Mock the selector to return true for auto-connect
      const store = configureStore({
        reducer: {
          wallet: walletSlice.reducer,
        },
        preloadedState: {
          wallet: {
            isConnected: false,
            currentProvider: null,
            accountInfo: null,
            connectionStatus: 'idle',
            error: null,
            availableProviders: ['hashpack'],
            preferences: {
              lastUsedProvider: 'hashpack',
              autoConnect: true,
            },
          },
        },
      });

      render(
        <Provider store={store}>
          <WalletContextProvider>
            <TestComponent />
          </WalletContextProvider>
        </Provider>
      );

      // Wait for the restoration attempt
      await waitFor(
        () => {
          expect(mockWalletService.restoreConnection).toHaveBeenCalled();
          expect(mockWalletService.loadAccountInfo).toHaveBeenCalled();
          expect(mockWalletService.getAccountInfo).toHaveBeenCalled();
          expect(mockWalletService.saveAccountInfo).toHaveBeenCalledWith(
            freshAccountInfo
          );
        },
        { timeout: 2000 }
      );
    });

    it('should handle account info fetch failure during restoration gracefully', async () => {
      const mockConnection: WalletConnection = {
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      };

      mockWalletService.restoreConnection.mockResolvedValue(mockConnection);
      mockWalletService.loadAccountInfo.mockReturnValue(null);
      mockWalletService.getAccountInfo.mockRejectedValue(
        new Error('Network error')
      );

      // Mock the selector to return true for auto-connect
      const store = configureStore({
        reducer: {
          wallet: walletSlice.reducer,
        },
        preloadedState: {
          wallet: {
            isConnected: false,
            currentProvider: null,
            accountInfo: null,
            connectionStatus: 'idle',
            error: null,
            availableProviders: ['hashpack'],
            preferences: {
              lastUsedProvider: 'hashpack',
              autoConnect: true,
            },
          },
        },
      });

      render(
        <Provider store={store}>
          <WalletContextProvider>
            <TestComponent />
          </WalletContextProvider>
        </Provider>
      );

      // Wait for the restoration attempt
      await waitFor(
        () => {
          expect(mockWalletService.restoreConnection).toHaveBeenCalled();
          expect(mockWalletService.getAccountInfo).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Should still connect successfully with basic account info
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
        expect(screen.getByTestId('account-id')).toHaveTextContent(
          '0.0.123456'
        );
      });
    });
  });
});
