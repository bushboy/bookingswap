/**
 * Wallet service exports
 */

export { BaseWalletAdapter } from './BaseWalletAdapter';
export { HashPackAdapter } from './HashPackAdapter';
export { BladeAdapter } from './BladeAdapter';
export { WalletService, walletService } from './WalletService';
export { WalletStateMonitor } from './WalletStateMonitor';
export { WalletConnectionValidator } from './WalletConnectionValidator';
export { ConnectionValidator, DEFAULT_VALIDATION_RULES } from './ConnectionValidator';
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

// Re-export ConnectionValidator types
export type {
  ValidationResult,
  ValidationRules,
} from './ConnectionValidator';

export { WalletErrorType } from '../../types/wallet';
