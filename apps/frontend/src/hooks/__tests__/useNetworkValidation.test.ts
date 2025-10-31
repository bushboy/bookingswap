import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useNetworkValidation } from '../useNetworkValidation';
import { walletService } from '../../services/wallet/WalletService';
import { walletSlice } from '../../store/slices/walletSlice';
import { NetworkType } from '../../types/wallet';

// Mock wallet service
jest.mock('../../services/wallet/WalletService');

const mockWalletService = walletService as jest.Mocked<typeof walletService>;

// Create test store
const createTestStore = (initialState = {}) => {
  return configureStore({
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
        availableProviders: [],
        preferences: {
          lastUsedProvider: null,
          autoConnect: false,
        },
        ...initialState,
      },
    },
  });
};

// Test wrapper component
const createWrapper = (store: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

describe('useNetworkValidation', () => {
  let mockNetworkValidator: any;
  let store: any;

  beforeEach(() => {
    // Mock network validator
    mockNetworkValidator = {
      validateNetwork: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn().mockReturnValue({
        expectedNetwork: 'testnet',
        allowAutoSwitch: false,
      }),
      createSwitchRequest: jest.fn(),
    };

    // Mock wallet service methods
    mockWalletService.getNetworkValidator.mockReturnValue(mockNetworkValidator);
    mockWalletService.requestNetworkSwitch = jest.fn();
    mockWalletService.setExpectedNetwork = jest.fn();
    mockWalletService.getExpectedNetwork = jest.fn().mockReturnValue('testnet');
    mockWalletService.addEventListener = jest.fn();
    mockWalletService.removeEventListener = jest.fn();

    // Create store with default state
    store = createTestStore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.validation).toBeNull();
      expect(result.current.isValidating).toBe(false);
      expect(result.current.isSwitching).toBe(false);
      expect(result.current.showSwitchModal).toBe(false);
      expect(result.current.networkValidator).toBe(mockNetworkValidator);
    });

    it('should set up wallet service event listeners', () => {
      renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
        'networkValidated',
        expect.any(Function)
      );
      expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
        'networkValidationFailed',
        expect.any(Function)
      );
      expect(mockWalletService.addEventListener).toHaveBeenCalledWith(
        'networkChanged',
        expect.any(Function)
      );
    });
  });

  describe('validateNetwork', () => {
    it('should not validate when wallet is not connected', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      act(() => {
        result.current.validateNetwork();
      });

      expect(mockNetworkValidator.validateNetwork).not.toHaveBeenCalled();
      expect(result.current.validation).toBeNull();
    });

    it('should validate network when wallet is connected', () => {
      const connectedStore = createTestStore({
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100',
          network: 'testnet',
        },
      });

      const mockValidationResult = {
        isValid: true,
        currentNetwork: 'testnet' as NetworkType,
        expectedNetwork: 'testnet' as NetworkType,
        canSwitch: false,
      };

      mockNetworkValidator.validateNetwork.mockReturnValue(mockValidationResult);

      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(connectedStore),
      });

      expect(mockNetworkValidator.validateNetwork).toHaveBeenCalledWith('testnet');
      expect(result.current.validation).toEqual(mockValidationResult);
    });

    it('should handle validation errors gracefully', () => {
      const connectedStore = createTestStore({
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100',
          network: 'testnet',
        },
      });

      mockNetworkValidator.validateNetwork.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(connectedStore),
      });

      expect(consoleSpy).toHaveBeenCalledWith('Error validating network:', expect.any(Error));
      expect(result.current.validation).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('requestNetworkSwitch', () => {
    it('should throw error when no provider is connected', async () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      await expect(
        act(async () => {
          await result.current.requestNetworkSwitch('mainnet');
        })
      ).rejects.toThrow('No wallet provider connected');
    });

    it('should call wallet service requestNetworkSwitch', async () => {
      const connectedStore = createTestStore({
        isConnected: true,
        currentProvider: 'hashpack',
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100',
          network: 'testnet',
        },
      });

      mockWalletService.requestNetworkSwitch.mockRejectedValue(
        new Error('Manual switch required')
      );

      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(connectedStore),
      });

      await expect(
        act(async () => {
          await result.current.requestNetworkSwitch('mainnet');
        })
      ).rejects.toThrow('Manual switch required');

      expect(mockWalletService.requestNetworkSwitch).toHaveBeenCalledWith('mainnet');
    });

    it('should set switching state during request', async () => {
      const connectedStore = createTestStore({
        isConnected: true,
        currentProvider: 'hashpack',
      });

      let resolveSwitchRequest: (value: any) => void;
      const switchPromise = new Promise((resolve) => {
        resolveSwitchRequest = resolve;
      });

      mockWalletService.requestNetworkSwitch.mockReturnValue(switchPromise);

      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(connectedStore),
      });

      // Start switch request
      act(() => {
        result.current.requestNetworkSwitch('mainnet');
      });

      expect(result.current.isSwitching).toBe(true);

      // Complete switch request
      act(() => {
        resolveSwitchRequest!(undefined);
      });

      await act(async () => {
        await switchPromise;
      });

      expect(result.current.isSwitching).toBe(false);
    });
  });

  describe('modal management', () => {
    it('should show and hide switch modal', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.showSwitchModal).toBe(false);

      act(() => {
        result.current.showNetworkSwitchModal();
      });

      expect(result.current.showSwitchModal).toBe(true);

      act(() => {
        result.current.hideNetworkSwitchModal();
      });

      expect(result.current.showSwitchModal).toBe(false);
    });
  });

  describe('handleSwitchConfirm', () => {
    it('should handle switch confirmation', async () => {
      const connectedStore = createTestStore({
        isConnected: true,
        currentProvider: 'hashpack',
      });

      mockWalletService.requestNetworkSwitch.mockRejectedValue(
        new Error('Manual switch required')
      );

      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(connectedStore),
      });

      const switchRequest = {
        targetNetwork: 'mainnet' as NetworkType,
        providerId: 'hashpack',
        isAutomatic: false,
      };

      await expect(
        act(async () => {
          await result.current.handleSwitchConfirm(switchRequest);
        })
      ).rejects.toThrow('Manual switch required');

      expect(mockWalletService.requestNetworkSwitch).toHaveBeenCalledWith('mainnet');
    });
  });

  describe('expected network management', () => {
    it('should set expected network', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      act(() => {
        result.current.setExpectedNetwork('mainnet');
      });

      expect(mockWalletService.setExpectedNetwork).toHaveBeenCalledWith('mainnet');
    });

    it('should get expected network', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      const network = result.current.getExpectedNetwork();

      expect(mockWalletService.getExpectedNetwork).toHaveBeenCalled();
      expect(network).toBe('testnet');
    });
  });

  describe('wallet service event handling', () => {
    it('should handle networkValidated events', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      const mockValidationResult = {
        isValid: false,
        currentNetwork: 'mainnet' as NetworkType,
        expectedNetwork: 'testnet' as NetworkType,
        canSwitch: true,
      };

      // Simulate networkValidated event
      const eventHandler = (mockWalletService.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'networkValidated')[1];

      act(() => {
        eventHandler(mockValidationResult);
      });

      expect(result.current.validation).toEqual(mockValidationResult);
    });

    it('should handle networkValidationFailed events', () => {
      const { result } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      const mockEvent = {
        validation: {
          isValid: false,
          currentNetwork: 'mainnet' as NetworkType,
          expectedNetwork: 'testnet' as NetworkType,
          canSwitch: true,
        },
      };

      // Simulate networkValidationFailed event
      const eventHandler = (mockWalletService.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'networkValidationFailed')[1];

      act(() => {
        eventHandler(mockEvent);
      });

      expect(result.current.validation).toEqual(mockEvent.validation);
      expect(result.current.showSwitchModal).toBe(true);
    });

    it('should handle networkChanged events', () => {
      const connectedStore = createTestStore({
        isConnected: true,
        accountInfo: {
          accountId: '0.0.123456',
          balance: '100',
          network: 'testnet',
        },
      });

      renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(connectedStore),
      });

      // Simulate networkChanged event
      const eventHandler = (mockWalletService.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'networkChanged')[1];

      act(() => {
        eventHandler({ oldNetwork: 'testnet', newNetwork: 'mainnet' });
      });

      // Should trigger re-validation
      expect(mockNetworkValidator.validateNetwork).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useNetworkValidation(), {
        wrapper: createWrapper(store),
      });

      unmount();

      expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
        'networkValidated',
        expect.any(Function)
      );
      expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
        'networkValidationFailed',
        expect.any(Function)
      );
      expect(mockWalletService.removeEventListener).toHaveBeenCalledWith(
        'networkChanged',
        expect.any(Function)
      );
    });
  });
});