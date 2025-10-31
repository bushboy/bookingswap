/**
 * Wallet provider initialization
 * This file registers all available wallet providers with the wallet service
 */

import { walletService } from './WalletService';
import { HashPackAdapter } from './HashPackAdapter';
import { BladeAdapter } from './BladeAdapter';
import { KabilaAdapter } from './KabilaAdapter';
import { YamgoAdapter } from './YamgoAdapter';
import { MockWalletAdapter } from './MockWalletAdapter';

/**
 * Initialize and register all wallet providers
 */
export function initializeWalletProviders(): void {
  console.log('🚀 Starting wallet provider initialization...');

  // Log environment information for debugging
  const envInfo = {
    isDev: import.meta.env.DEV,
    mockWalletEnvVar: import.meta.env.VITE_ENABLE_MOCK_WALLET,
    nodeEnv: import.meta.env.NODE_ENV,
  };
  console.log('Environment info:', envInfo);

  // Register Mock wallet first for testing (always available in development)
  const shouldRegisterMock = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_WALLET === 'true';
  console.log(`Mock wallet registration decision: ${shouldRegisterMock}`);

  if (shouldRegisterMock) {
    try {
      console.log('🔧 Creating MockWalletAdapter...');
      const mockAdapter = new MockWalletAdapter();
      console.log('🔧 MockWalletAdapter created:', mockAdapter.id, mockAdapter.name);

      console.log('🔧 Registering mock wallet with service...');
      walletService.registerProvider(mockAdapter);

      console.log('🔧 Verifying registration...');
      const registeredProvider = walletService.getProvider('mock');
      console.log('🔧 Retrieved provider:', registeredProvider?.id, registeredProvider?.name);

      console.log('✅ Mock wallet registered successfully for development/testing');
    } catch (error) {
      console.error('❌ Failed to register mock wallet:', error);
      console.error('❌ Error details:', error);
    }
  } else {
    console.log('⏭️ Skipping mock wallet registration (not in dev mode and VITE_ENABLE_MOCK_WALLET not set)');
  }

  // Register production wallet adapters
  const hashPackAdapter = new HashPackAdapter();
  walletService.registerProvider(hashPackAdapter);

  const kabilaAdapter = new KabilaAdapter();
  walletService.registerProvider(kabilaAdapter);

  const yamgoAdapter = new YamgoAdapter();
  walletService.registerProvider(yamgoAdapter);

  const bladeAdapter = new BladeAdapter();
  walletService.registerProvider(bladeAdapter);

  // Mark service as initialized after all providers are registered
  walletService.markAsInitialized();

  const finalStatus = walletService.getInitializationStatus();
  console.log('🎉 Wallet providers initialization complete:', {
    environment: import.meta.env.DEV ? 'development' : 'production',
    providerCount: finalStatus.providerCount,
    providers: finalStatus.providers.map(id => {
      const provider = walletService.getProvider(id);
      return { id, name: provider?.name || 'Unknown' };
    }),
    isInitialized: finalStatus.isInitialized,
  });

  // Additional verification
  console.log('🔍 Final verification:');
  console.log('  - Service validation:', walletService.validateServiceState());
  console.log('  - Mock provider available:', walletService.isProviderAvailable('mock'));
  console.log('  - All providers:', walletService.getProviderIds());
}

/**
 * Get all registered provider instances
 */
export function getRegisteredProviders() {
  return walletService.getProviders();
}

/**
 * Get available provider instances (those that are installed/accessible)
 */
export async function getAvailableProviders() {
  return await walletService.getAvailableProviders();
}
