/**
 * Wallet service exports
 */

export { BaseWalletAdapter } from './BaseWalletAdapter';
export { HashPackAdapter } from './HashPackAdapter';
export { BladeAdapter } from './BladeAdapter';
export { WalletService, walletService } from './WalletService';
export { WalletStateMonitor } from './WalletStateMonitor';
export { WalletConnectionValidator } from './WalletConnectionValidator';
export {
  initializeWalletProviders,
  getRegisteredProviders,
  getAvailableProviders,
} from './providers';

// Re-export types for convenience
export type {
  WalletProvider,
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletState,
  WalletPreferences,
  NetworkType,
  ConnectionStatus,
} from '../../types/wallet';

// Re-export WalletStateMonitor types
export type {
  StateChange,
  WalletState as MonitorWalletState,
  StateChangeCallback,
  WalletStateMonitorConfig,
} from './WalletStateMonitor';

export { WalletErrorType } from '../../types/wallet';
