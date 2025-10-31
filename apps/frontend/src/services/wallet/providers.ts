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
  // Register Mock wallet for testing (always available in development)
  if (
    import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_MOCK_WALLET === 'true'
  ) {
    const mockAdapter = new MockWalletAdapter();
    walletService.registerProvider(mockAdapter);
  }

  // Register HashPack adapter (original)
  const hashPackAdapter = new HashPackAdapter();
  walletService.registerProvider(hashPackAdapter);

  // Register Kabila adapter (alternative - good for testing)
  const kabilaAdapter = new KabilaAdapter();
  walletService.registerProvider(kabilaAdapter);

  // Register Yamgo adapter (alternative - good for testing)
  const yamgoAdapter = new YamgoAdapter();
  walletService.registerProvider(yamgoAdapter);

  // Register Blade adapter (original - may be inactive)
  const bladeAdapter = new BladeAdapter();
  walletService.registerProvider(bladeAdapter);

  console.log('Wallet providers initialized:', {
    environment: import.meta.env.DEV ? 'development' : 'production',
    providers: walletService
      .getProviders()
      .map(p => ({ id: p.id, name: p.name })),
  });
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
