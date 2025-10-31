import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  useWallet,
  useWalletConnection,
  useWalletAccount,
  useWalletError,
  useWalletProviders,
  useWalletUI,
  useWalletStatus,
} from '../useWallet';
import { WalletContextProvider } from '@/contexts/WalletContext';
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

const createWrapper = (store: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <WalletContextProvider>{children}</WalletContextProvider>
    </Provider>
  );
};

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should return wallet state and methods', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current).toHaveProperty('connect');
    expect(result.current).toHaveProperty('disconnect');
    expect(result.current).toHaveProperty('refreshAccountInfo');
    expect(result.current).toHaveProperty('refreshBalance');
    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('connectionStatus');
    expect(result.current).toHaveProperty('accountInfo');
    expect(result.current).toHaveProperty('error');
  });

  it('should return correct initial state', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('idle');
    expect(result.current.currentProvider).toBe(null);
    expect(result.current.accountInfo).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should return connected state when wallet is connected', () => {
    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.5',
          network: 'testnet' as const,
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

    const store = createTestStore(connectedState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.currentProvider).toBe('hashpack');
    expect(result.current.accountInfo?.accountId).toBe('0.0.123456');
    expect(result.current.balance).toBe('100.5');
  });
});

describe('useWalletConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should provide connection methods and state', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletConnection(), { wrapper });

    expect(result.current).toHaveProperty('connect');
    expect(result.current).toHaveProperty('disconnect');
    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('isConnecting');
    expect(result.current).toHaveProperty('canConnect');
    expect(result.current).toHaveProperty('canDisconnect');
  });

  it('should handle connection when canConnect is true', async () => {
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

    const initialState = {
      wallet: {
        isConnected: false,
        currentProvider: null,
        accountInfo: null,
        connectionStatus: 'idle' as const,
        error: null,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
      },
    };

    const store = createTestStore(initialState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletConnection(), { wrapper });

    await act(async () => {
      await result.current.connect('hashpack');
    });

    expect(mockWalletService.connect).toHaveBeenCalledWith('hashpack');
  });

  it('should throw error when trying to connect when canConnect is false', async () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletConnection(), { wrapper });

    await expect(result.current.connect('hashpack')).rejects.toThrow(
      'Cannot connect wallet at this time'
    );
  });

  it('should handle disconnection when canDisconnect is true', async () => {
    mockWalletService.disconnect.mockResolvedValue();

    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.5',
          network: 'testnet' as const,
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

    const store = createTestStore(connectedState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletConnection(), { wrapper });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockWalletService.disconnect).toHaveBeenCalled();
  });
});

describe('useWalletAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should provide account information and methods', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletAccount(), { wrapper });

    expect(result.current).toHaveProperty('accountInfo');
    expect(result.current).toHaveProperty('address');
    expect(result.current).toHaveProperty('balance');
    expect(result.current).toHaveProperty('network');
    expect(result.current).toHaveProperty('truncatedAddress');
    expect(result.current).toHaveProperty('refreshAccountInfo');
    expect(result.current).toHaveProperty('refreshBalance');
  });

  it('should return account information when connected', () => {
    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456789',
          balance: '100.5',
          network: 'testnet' as const,
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

    const store = createTestStore(connectedState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletAccount(), { wrapper });

    expect(result.current.address).toBe('0.0.123456789');
    expect(result.current.balance).toBe('100.5');
    expect(result.current.network).toBe('testnet');
    expect(result.current.truncatedAddress).toBe('0.0.12...6789');
  });
});

describe('useWalletError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should provide error information and methods', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletError(), { wrapper });

    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('hasError');
    expect(result.current).toHaveProperty('errorMessage');
    expect(result.current).toHaveProperty('errorType');
    expect(result.current).toHaveProperty('clearError');
    expect(result.current).toHaveProperty('retryConnection');
    expect(result.current).toHaveProperty('canRetryConnection');
    expect(result.current).toHaveProperty('needsProviderInstallation');
    expect(result.current).toHaveProperty('needsNetworkSwitch');
  });

  it('should return error information when there is an error', () => {
    const errorState = {
      wallet: {
        isConnected: false,
        currentProvider: null,
        accountInfo: null,
        connectionStatus: 'error' as const,
        error: {
          type: WalletErrorType.CONNECTION_REJECTED,
          message: 'User rejected connection',
        } as WalletError,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: 'hashpack',
          autoConnect: false,
        },
      },
    };

    const store = createTestStore(errorState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletError(), { wrapper });

    expect(result.current.hasError).toBe(true);
    expect(result.current.errorMessage).toBe('User rejected connection');
    expect(result.current.errorType).toBe(WalletErrorType.CONNECTION_REJECTED);
  });
});

describe('useWalletProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should provide provider information and methods', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletProviders(), { wrapper });

    expect(result.current).toHaveProperty('availableProviders');
    expect(result.current).toHaveProperty('currentProvider');
    expect(result.current).toHaveProperty('refreshAvailableProviders');
    expect(result.current).toHaveProperty('hasProviders');
  });

  it('should return provider information', () => {
    const stateWithProviders = {
      wallet: {
        isConnected: false,
        currentProvider: null,
        accountInfo: null,
        connectionStatus: 'idle' as const,
        error: null,
        availableProviders: ['hashpack', 'blade'],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
      },
    };

    const store = createTestStore(stateWithProviders);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletProviders(), { wrapper });

    expect(result.current.availableProviders).toEqual(['hashpack', 'blade']);
    expect(result.current.hasProviders).toBe(true);
  });
});

describe('useWalletUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should provide UI state information', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletUI(), { wrapper });

    expect(result.current).toHaveProperty('shouldShowConnectButton');
    expect(result.current).toHaveProperty('shouldShowWalletInfo');
    expect(result.current).toHaveProperty('isConnecting');
    expect(result.current).toHaveProperty('hasError');
  });

  it('should return correct UI state for disconnected wallet', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletUI(), { wrapper });

    expect(result.current.shouldShowConnectButton).toBe(true);
    expect(result.current.shouldShowWalletInfo).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should return correct UI state for connected wallet', () => {
    const connectedState = {
      wallet: {
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100.5',
          network: 'testnet' as const,
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

    const store = createTestStore(connectedState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletUI(), { wrapper });

    expect(result.current.shouldShowConnectButton).toBe(false);
    expect(result.current.shouldShowWalletInfo).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });
});

describe('useWalletStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletService.isConnected.mockReturnValue(false);
    mockWalletService.getAvailableProviders.mockResolvedValue([]);
  });

  it('should provide status information', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletStatus(), { wrapper });

    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('isConnecting');
    expect(result.current).toHaveProperty('connectionStatus');
    expect(result.current).toHaveProperty('hasError');
    expect(result.current).toHaveProperty('canConnect');
    expect(result.current).toHaveProperty('canDisconnect');
    expect(result.current).toHaveProperty('isIdle');
    expect(result.current).toHaveProperty('isError');
  });

  it('should return correct status for idle state', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletStatus(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.connectionStatus).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('should return correct status for connecting state', () => {
    const connectingState = {
      wallet: {
        isConnected: false,
        currentProvider: 'hashpack',
        accountInfo: null,
        connectionStatus: 'connecting' as const,
        error: null,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
      },
    };

    const store = createTestStore(connectingState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletStatus(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.connectionStatus).toBe('connecting');
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should return correct status for error state', () => {
    const errorState = {
      wallet: {
        isConnected: false,
        currentProvider: null,
        accountInfo: null,
        connectionStatus: 'error' as const,
        error: {
          type: WalletErrorType.CONNECTION_REJECTED,
          message: 'User rejected connection',
        } as WalletError,
        availableProviders: ['hashpack'],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
      },
    };

    const store = createTestStore(errorState);
    const wrapper = createWrapper(store);

    const { result } = renderHook(() => useWalletStatus(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.hasError).toBe(true);
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isError).toBe(true);
  });
});
