/**
 * Core wallet integration types and interfaces
 */

export type NetworkType = 'mainnet' | 'testnet';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export enum WalletErrorType {
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  WALLET_LOCKED = 'WALLET_LOCKED',
  WRONG_NETWORK = 'WRONG_NETWORK',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface WalletError {
  type: WalletErrorType;
  message: string;
  details?: any;
}

export interface AccountInfo {
  accountId: string;
  balance: string;
  network: NetworkType;
}

export interface WalletConnection {
  accountId: string;
  network: NetworkType;
  isConnected: boolean;
}

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  isAvailable(): Promise<boolean>;
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  getAccountInfo(): Promise<AccountInfo>;
  getBalance(): Promise<string>;
}

export interface WalletState {
  isConnected: boolean;
  currentProvider: string | null;
  accountInfo: AccountInfo | null;
  connectionStatus: ConnectionStatus;
  error: WalletError | null;
  availableProviders: string[];
}

export interface WalletPreferences {
  lastUsedProvider: string | null;
  autoConnect: boolean;
  connectionTimestamp: number;
}
