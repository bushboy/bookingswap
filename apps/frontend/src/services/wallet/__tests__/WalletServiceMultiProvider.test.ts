import { WalletService } from '../WalletService';
import {
  WalletProvider,
  WalletConnection,
  AccountInfo,
  WalletErrorType,
} from '../../../types/wallet';
import { WalletStorage } from '../../../utils/walletStorage';

// Mock WalletStorage
jest.mock('../../../utils/walletStorage');
const mockWalletStorage = WalletStorage as jest.Mocked<typeof WalletStorage>;

// Mock wallet error handling
jest.mock('../../../utils/walletErrorHandling', () => ({
  WalletErrorHandler: {
    handleProviderError: jest.fn((error, providerId) => error),
    handleConnectionError: jest.fn((error, providerId) => error),
    handleAccountError: jest.fn(error => error),
  },
  createWalletRetryHandler: jest.fn(
    operation => (fn: () => Promise<any>) => fn()
  ),
  createWalletError: jest.fn((type, message, details) => ({
    type,
    message,
    details,
  })),
  isWalletError: jest.fn(
    error => error && typeof error === 'object' && 'type' in error
  ),
}));

// Mock provider implementations
class MockProvider implements WalletProvider {
  public id: string;
  public name: string;
  public icon: string;
  private _isAvailable: boolean;
  private _shouldFailConnection: boolean;
  private _shouldFailDisconnection: boolean;
  private listeners: Map<string, Function[]> = new Map();

  constructor(
    id: string,
    name: string,
    isAvailable = true,
    shouldFailConnection = false,
    shouldFailDisconnection = false
  ) {
    this.id = id;
    this.name = name;
    this.icon = `/icons/${id}.svg`;
    this._isAvailable = isAvailable;
    this._shouldFailConnection = shouldFailConnection;
    this._shouldFailDisconnection = shouldFailDisconnection;
  }

  async isAvailable(): Promise<boolean> {
    return this._isAvailable;
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available;
  }

  setShouldFailConnection(shouldFail: boolean): void {
    this._shouldFailConnection = shouldFail;
  }

  setShouldFailDisconnection(shouldFail: boolean): void {
    this._shouldFailDisconnection = shouldFail;
  }

  async connect(): Promise<WalletConnection> {
    if (this._shouldFailConnection) {
      throw new Error(`Connection failed for ${this.name}`);
    }
    return {
      accountId: `0.0.${this.id}123`,
      network: 'testnet',
      isConnected: true,
    };
  }

  async disconnect(): Promise<void> {
    if (this._shouldFailDisconnection) {
      throw new Error(`Disconnection failed for ${this.name}`);
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return {
      accountId: `0.0.${this.id}123`,
      balance: '100.0',
      network: 'testnet',
    };
  }

  async getBalance(): Promise<string> {
    return '100.0';
  }

  addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(...args));
    }
  }
}

describe('WalletService Multi-Provider Support', () => {
  let walletService: WalletService;
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;
  let mockProvider3: MockProvider;

  beforeEach(() => {
    walletService = new WalletService();
    mockProvider1 = new MockProvider('hashpack', 'HashPack');
    mockProvider2 = new MockProvider('blade', 'Blade');
    mockProvider3 = new MockProvider('metamask', 'MetaMask', false); // Not available

    // Reset mocks
    jest.clearAllMocks();
    mockWalletStorage.isStorageAvailable.mockReturnValue(true);
    mockWalletStorage.loadPreferences.mockReturnValue({
      lastUsedProvider: null,
      autoConnect: false,
      connectionTimestamp: 0,
    });
  });

  describe('Provider Registration', () => {
    it('should register providers successfully', () => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);

      expect(walletService.getProviderCount()).toBe(2);
      expect(walletService.isProviderRegistered('hashpack')).toBe(true);
      expect(walletService.isProviderRegistered('blade')).toBe(true);
      expect(walletService.isProviderRegistered('metamask')).toBe(false);
    });

    it('should emit providerRegistered event when registering a provider', () => {
      const eventSpy = jest.fn();
      walletService.addEventListener('providerRegistered', eventSpy);

      walletService.registerProvider(mockProvider1);

      expect(eventSpy).toHaveBeenCalledWith('hashpack');
    });

    it('should warn when registering a provider with duplicate ID', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider1); // Duplicate

      expect(consoleSpy).toHaveBeenCalledWith(
        'Provider hashpack is already registered, replacing existing provider'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when registering invalid provider', () => {
      const invalidProvider = { name: 'Invalid' } as WalletProvider;

      expect(() => {
        walletService.registerProvider(invalidProvider);
      }).toThrow('Provider must have valid id and name');
    });

    it('should get provider by ID', () => {
      walletService.registerProvider(mockProvider1);

      const provider = walletService.getProvider('hashpack');
      expect(provider).toBe(mockProvider1);

      const nonExistentProvider = walletService.getProvider('nonexistent');
      expect(nonExistentProvider).toBeNull();
    });

    it('should get all providers', () => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);

      const providers = walletService.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toContain(mockProvider1);
      expect(providers).toContain(mockProvider2);
    });

    it('should get provider IDs', () => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);

      const providerIds = walletService.getProviderIds();
      expect(providerIds).toEqual(['hashpack', 'blade']);
    });
  });

  describe('Provider Unregistration', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);
    });

    it('should unregister provider successfully', async () => {
      await walletService.unregisterProvider('hashpack');

      expect(walletService.isProviderRegistered('hashpack')).toBe(false);
      expect(walletService.getProviderCount()).toBe(1);
    });

    it('should emit providerUnregistered event', async () => {
      const eventSpy = jest.fn();
      walletService.addEventListener('providerUnregistered', eventSpy);

      await walletService.unregisterProvider('hashpack');

      expect(eventSpy).toHaveBeenCalledWith('hashpack');
    });

    it('should disconnect current provider when unregistering it', async () => {
      // Connect to provider first
      await walletService.connect('hashpack');
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');

      // Unregister the connected provider
      await walletService.unregisterProvider('hashpack');

      expect(walletService.getCurrentProvider()).toBeNull();
      expect(walletService.isConnected()).toBe(false);
    });

    it('should handle unregistering non-existent provider gracefully', async () => {
      await expect(
        walletService.unregisterProvider('nonexistent')
      ).resolves.not.toThrow();
    });
  });

  describe('Provider Availability', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1); // Available
      walletService.registerProvider(mockProvider2); // Available
      walletService.registerProvider(mockProvider3); // Not available
    });

    it('should get available providers only', async () => {
      const availableProviders = await walletService.getAvailableProviders();

      expect(availableProviders).toHaveLength(2);
      expect(availableProviders.map(p => p.id)).toEqual(['hashpack', 'blade']);
    });

    it('should get provider availability status', async () => {
      const availabilityStatus =
        await walletService.getProviderAvailabilityStatus();

      expect(availabilityStatus.get('hashpack')).toBe(true);
      expect(availabilityStatus.get('blade')).toBe(true);
      expect(availabilityStatus.get('metamask')).toBe(false);
    });

    it('should check individual provider availability', async () => {
      expect(await walletService.isProviderAvailable('hashpack')).toBe(true);
      expect(await walletService.isProviderAvailable('blade')).toBe(true);
      expect(await walletService.isProviderAvailable('metamask')).toBe(false);
      expect(await walletService.isProviderAvailable('nonexistent')).toBe(
        false
      );
    });

    it('should handle provider availability check errors gracefully', async () => {
      const errorProvider = new MockProvider('error', 'Error Provider');
      errorProvider.isAvailable = jest
        .fn()
        .mockRejectedValue(new Error('Availability check failed'));
      walletService.registerProvider(errorProvider);

      expect(await walletService.isProviderAvailable('error')).toBe(false);
    });

    it('should refresh provider availability and emit events', async () => {
      const eventSpy = jest.fn();
      walletService.addEventListener('providersAvailabilityChanged', eventSpy);

      await walletService.refreshProviderAvailability();

      expect(eventSpy).toHaveBeenCalledWith({
        availabilityStatus: {
          hashpack: true,
          blade: true,
          metamask: false,
        },
        availableProviders: ['hashpack', 'blade'],
      });
    });
  });

  describe('Provider Switching', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);
    });

    it('should switch between providers successfully', async () => {
      // Connect to first provider
      await walletService.connect('hashpack');
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');

      // Switch to second provider
      const connection = await walletService.switchProvider('blade');

      expect(walletService.getCurrentProvider()?.id).toBe('blade');
      expect(connection.accountId).toBe('0.0.blade123');
    });

    it('should emit provider switching events', async () => {
      const switchingEventSpy = jest.fn();
      const switchedEventSpy = jest.fn();
      const changedEventSpy = jest.fn();

      walletService.addEventListener('providerSwitching', switchingEventSpy);
      walletService.addEventListener('providerSwitched', switchedEventSpy);
      walletService.addEventListener('providerChanged', changedEventSpy);

      // Connect to first provider
      await walletService.connect('hashpack');

      // Clear previous events
      switchingEventSpy.mockClear();
      switchedEventSpy.mockClear();
      changedEventSpy.mockClear();

      // Switch to second provider
      await walletService.switchProvider('blade');

      expect(switchingEventSpy).toHaveBeenCalledWith({
        from: 'hashpack',
        to: 'blade',
      });
      expect(switchedEventSpy).toHaveBeenCalledWith({
        from: 'hashpack',
        to: 'blade',
      });
      expect(changedEventSpy).toHaveBeenCalledWith('blade');
    });

    it('should return current connection when switching to same provider', async () => {
      // Connect to provider
      const originalConnection = await walletService.connect('hashpack');

      // Switch to same provider
      const switchConnection = await walletService.switchProvider('hashpack');

      expect(switchConnection).toEqual(originalConnection);
    });

    it('should handle provider switch failures', async () => {
      const failEventSpy = jest.fn();
      walletService.addEventListener('providerSwitchFailed', failEventSpy);

      // Connect to first provider
      await walletService.connect('hashpack');

      // Make second provider fail connection
      mockProvider2.setShouldFailConnection(true);

      // Attempt to switch to failing provider
      await expect(walletService.switchProvider('blade')).rejects.toThrow();

      expect(failEventSpy).toHaveBeenCalledWith({
        from: 'hashpack',
        to: 'blade',
        error: expect.any(Error),
      });
    });

    it('should switch from no provider to a provider', async () => {
      const switchingEventSpy = jest.fn();
      const switchedEventSpy = jest.fn();

      walletService.addEventListener('providerSwitching', switchingEventSpy);
      walletService.addEventListener('providerSwitched', switchedEventSpy);

      // Switch to provider when none is connected
      await walletService.switchProvider('hashpack');

      expect(switchingEventSpy).toHaveBeenCalledWith({
        from: null,
        to: 'hashpack',
      });
      expect(switchedEventSpy).toHaveBeenCalledWith({
        from: null,
        to: 'hashpack',
      });
    });
  });

  describe('Multi-Provider Connection Management', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);
    });

    it('should disconnect current provider when connecting to different provider', async () => {
      // Connect to first provider
      await walletService.connect('hashpack');
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');

      // Connect to second provider (should disconnect first)
      await walletService.connect('blade');

      expect(walletService.getCurrentProvider()?.id).toBe('blade');
    });

    it('should handle connection to unavailable provider', async () => {
      walletService.registerProvider(mockProvider3); // Not available

      await expect(walletService.connect('metamask')).rejects.toThrow();
    });

    it('should handle connection to non-existent provider', async () => {
      await expect(walletService.connect('nonexistent')).rejects.toThrow();
    });

    it('should maintain provider state across operations', async () => {
      // Connect to provider
      await walletService.connect('hashpack');

      // Get account info
      const accountInfo = await walletService.getAccountInfo();
      expect(accountInfo.accountId).toBe('0.0.hashpack123');

      // Get balance
      const balance = await walletService.getBalance();
      expect(balance).toBe('100.0');

      // Provider should still be connected
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');
      expect(walletService.isConnected()).toBe(true);
    });
  });

  describe('Provider Event Handling', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);
    });

    it('should handle provider disconnect events', async () => {
      const disconnectSpy = jest.fn();
      walletService.addEventListener('disconnect', disconnectSpy);

      // Connect to provider
      await walletService.connect('hashpack');

      // Simulate provider disconnect event
      mockProvider1.emit('disconnect');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(walletService.getCurrentProvider()).toBeNull();
    });

    it('should handle account changed events', async () => {
      const accountChangedSpy = jest.fn();
      walletService.addEventListener('accountChanged', accountChangedSpy);

      // Connect to provider
      await walletService.connect('hashpack');

      // Simulate account change
      const newAccountInfo = {
        accountId: '0.0.456',
        balance: '200.0',
        network: 'mainnet' as const,
      };
      mockProvider1.emit('accountChanged', newAccountInfo);

      expect(accountChangedSpy).toHaveBeenCalledWith(newAccountInfo);
    });

    it('should handle network changed events', async () => {
      const networkChangedSpy = jest.fn();
      walletService.addEventListener('networkChanged', networkChangedSpy);

      // Connect to provider
      await walletService.connect('hashpack');

      // Simulate network change
      mockProvider1.emit('networkChanged', 'mainnet');

      expect(networkChangedSpy).toHaveBeenCalledWith('mainnet');
    });

    it('should only handle events from current provider', async () => {
      const disconnectSpy = jest.fn();
      walletService.addEventListener('disconnect', disconnectSpy);

      // Connect to first provider
      await walletService.connect('hashpack');

      // Switch to second provider
      await walletService.switchProvider('blade');

      // Emit disconnect from first provider (should not trigger disconnect)
      mockProvider1.emit('disconnect');

      expect(disconnectSpy).not.toHaveBeenCalled();
      expect(walletService.getCurrentProvider()?.id).toBe('blade');
    });
  });

  describe('Error Handling in Multi-Provider Scenarios', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);
    });

    it('should handle provider registration errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Try to register provider with missing properties
      expect(() => {
        walletService.registerProvider({} as WalletProvider);
      }).toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle provider availability check errors', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Make provider throw error during availability check
      mockProvider1.isAvailable = jest
        .fn()
        .mockRejectedValue(new Error('Check failed'));

      const availableProviders = await walletService.getAvailableProviders();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking availability for provider hashpack:',
        expect.any(Error)
      );
      expect(availableProviders).not.toContain(mockProvider1);

      consoleSpy.mockRestore();
    });

    it('should handle disconnection errors during provider unregistration', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Connect to provider
      await walletService.connect('hashpack');

      // Make provider fail disconnection
      mockProvider1.setShouldFailDisconnection(true);

      // Unregister should still work despite disconnection error
      await walletService.unregisterProvider('hashpack');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error disconnecting provider hashpack during unregistration:',
        expect.any(Error)
      );
      expect(walletService.isProviderRegistered('hashpack')).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
