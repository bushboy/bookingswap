import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from '../WalletService';
import { HashPackAdapter } from '../HashPackAdapter';
import { BladeAdapter } from '../BladeAdapter';

// Mock the wallet storage
vi.mock('../../../utils/walletStorage');

// Mock the wallet error handling
vi.mock('../../../utils/walletErrorHandling', () => ({
  WalletErrorHandler: {
    handleProviderError: vi.fn(error => error),
    handleConnectionError: vi.fn(error => error),
    handleAccountError: vi.fn(error => error),
  },
  createWalletRetryHandler: vi.fn(() => (fn: () => Promise<any>) => fn()),
  createWalletError: vi.fn((type, message, details) => ({
    type,
    message,
    details,
  })),
  isWalletError: vi.fn(
    error => error && typeof error === 'object' && 'type' in error
  ),
}));

describe('Multi-Provider Integration Test', () => {
  let walletService: WalletService;
  let hashPackAdapter: HashPackAdapter;
  let bladeAdapter: BladeAdapter;

  beforeEach(() => {
    walletService = new WalletService();

    // Create mock adapters
    hashPackAdapter = {
      id: 'hashpack',
      name: 'HashPack',
      icon: '/icons/hashpack.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue({
        accountId: '0.0.123',
        network: 'testnet',
        isConnected: true,
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue({
        accountId: '0.0.123',
        balance: '100.0',
        network: 'testnet',
      }),
      getBalance: vi.fn().mockResolvedValue('100.0'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    bladeAdapter = {
      id: 'blade',
      name: 'Blade',
      icon: '/icons/blade.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue({
        accountId: '0.0.456',
        network: 'testnet',
        isConnected: true,
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue({
        accountId: '0.0.456',
        balance: '200.0',
        network: 'testnet',
      }),
      getBalance: vi.fn().mockResolvedValue('200.0'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
  });

  describe('Requirements 6.3, 6.4, 6.5 - Multi-Provider Architecture', () => {
    it('should provide extensible architecture for adding new wallet providers (Requirement 6.3)', () => {
      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Verify providers are registered
      expect(walletService.getProviderCount()).toBe(2);
      expect(walletService.isProviderRegistered('hashpack')).toBe(true);
      expect(walletService.isProviderRegistered('blade')).toBe(true);

      // Verify providers can be retrieved
      const providers = walletService.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.id)).toEqual(['hashpack', 'blade']);
    });

    it('should automatically include new providers in wallet selection interface (Requirement 6.4)', async () => {
      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Get available providers (simulates what the UI would do)
      const availableProviders = await walletService.getAvailableProviders();

      // Both providers should be available for selection
      expect(availableProviders).toHaveLength(2);
      expect(availableProviders.map(p => p.id)).toEqual(['hashpack', 'blade']);
    });

    it('should hide unavailable providers from selection interface (Requirement 6.5)', async () => {
      // Make blade unavailable
      bladeAdapter.isAvailable = vi.fn().mockResolvedValue(false);

      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Get available providers
      const availableProviders = await walletService.getAvailableProviders();

      // Only HashPack should be available
      expect(availableProviders).toHaveLength(1);
      expect(availableProviders[0].id).toBe('hashpack');

      // Verify availability status
      const availabilityStatus =
        await walletService.getProviderAvailabilityStatus();
      expect(availabilityStatus.get('hashpack')).toBe(true);
      expect(availabilityStatus.get('blade')).toBe(false);
    });

    it('should support provider switching functionality', async () => {
      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Connect to HashPack first
      const hashPackConnection = await walletService.connect('hashpack');
      expect(hashPackConnection.accountId).toBe('0.0.123');
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');

      // Switch to Blade
      const bladeConnection = await walletService.switchProvider('blade');
      expect(bladeConnection.accountId).toBe('0.0.456');
      expect(walletService.getCurrentProvider()?.id).toBe('blade');

      // Verify HashPack was disconnected
      expect(hashPackAdapter.disconnect).toHaveBeenCalled();
    });

    it('should handle dynamic provider availability changes', async () => {
      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Initially both available
      let availableProviders = await walletService.getAvailableProviders();
      expect(availableProviders).toHaveLength(2);

      // Make HashPack unavailable
      hashPackAdapter.isAvailable = vi.fn().mockResolvedValue(false);

      // Refresh availability
      await walletService.refreshProviderAvailability();

      // Check individual provider availability
      expect(await walletService.isProviderAvailable('hashpack')).toBe(false);
      expect(await walletService.isProviderAvailable('blade')).toBe(true);

      // Get updated available providers
      availableProviders = await walletService.getAvailableProviders();
      expect(availableProviders).toHaveLength(1);
      expect(availableProviders[0].id).toBe('blade');
    });

    it('should emit events for provider registration and availability changes', async () => {
      const providerRegisteredSpy = vi.fn();
      const availabilityChangedSpy = vi.fn();

      walletService.addEventListener(
        'providerRegistered',
        providerRegisteredSpy
      );
      walletService.addEventListener(
        'providersAvailabilityChanged',
        availabilityChangedSpy
      );

      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Verify registration events
      expect(providerRegisteredSpy).toHaveBeenCalledWith('hashpack');
      expect(providerRegisteredSpy).toHaveBeenCalledWith('blade');

      // Refresh availability to trigger event
      await walletService.refreshProviderAvailability();

      // Verify availability change event
      expect(availabilityChangedSpy).toHaveBeenCalledWith({
        availabilityStatus: {
          hashpack: true,
          blade: true,
        },
        availableProviders: ['hashpack', 'blade'],
      });
    });

    it('should handle provider unregistration correctly', async () => {
      const providerUnregisteredSpy = vi.fn();
      walletService.addEventListener(
        'providerUnregistered',
        providerUnregisteredSpy
      );

      // Register providers
      walletService.registerProvider(hashPackAdapter);
      walletService.registerProvider(bladeAdapter);

      // Connect to HashPack
      await walletService.connect('hashpack');
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');

      // Unregister HashPack (should disconnect it)
      await walletService.unregisterProvider('hashpack');

      // Verify unregistration
      expect(walletService.isProviderRegistered('hashpack')).toBe(false);
      expect(walletService.getCurrentProvider()).toBeNull();
      expect(providerUnregisteredSpy).toHaveBeenCalledWith('hashpack');

      // Verify only Blade remains
      expect(walletService.getProviderCount()).toBe(1);
      expect(walletService.getProviderIds()).toEqual(['blade']);
    });
  });
});
