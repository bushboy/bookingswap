import { BaseWalletAdapter } from './BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
  NetworkType,
} from '../../types/wallet';

// HashPack wallet interface (based on HashPack documentation)
interface HashPackWallet {
  connectToLocalWallet(): Promise<{
    accountIds: string[];
    network: string;
  }>;
  disconnect(): Promise<void>;
  getAccountBalance(accountId: string): Promise<{
    hbars: number;
  }>;
  isConnected(): boolean;
  getAccountInfo(): Promise<{
    accountId: string;
    network: string;
  }>;
}

// Global HashPack interface
declare global {
  interface Window {
    hashpack?: {
      isAvailable: boolean;
      connectToLocalWallet(): Promise<{
        accountIds: string[];
        network: string;
      }>;
      disconnect(): Promise<void>;
      getAccountBalance(accountId: string): Promise<{
        hbars: number;
      }>;
      isConnected(): boolean;
      getAccountInfo(): Promise<{
        accountId: string;
        network: string;
      }>;
    };
  }
}

/**
 * HashPack wallet adapter implementation
 * Provides integration with HashPack wallet extension
 */
export class HashPackAdapter extends BaseWalletAdapter {
  public readonly id = 'hashpack';
  public readonly name = 'HashPack';
  public readonly icon = '/icons/hashpack.svg'; // Placeholder icon path

  private hashpack: HashPackWallet | null = null;

  /**
   * Check if HashPack wallet is available (extension installed)
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Check if HashPack is available in the window object
      return (
        typeof window !== 'undefined' &&
        window.hashpack !== undefined &&
        window.hashpack.isAvailable === true
      );
    } catch (error) {
      console.warn('Error checking HashPack availability:', error);
      return false;
    }
  }

  /**
   * Connect to HashPack wallet
   */
  public async connect(): Promise<WalletConnection> {
    try {
      if (!(await this.isAvailable())) {
        throw this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'HashPack wallet is not installed. Please install the HashPack browser extension.'
        );
      }

      this.hashpack = window.hashpack!;

      // Attempt to connect to the wallet
      const connectionResult = await this.hashpack.connectToLocalWallet();

      if (
        !connectionResult.accountIds ||
        connectionResult.accountIds.length === 0
      ) {
        throw this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'No accounts found in HashPack wallet'
        );
      }

      // Use the first account
      const accountId = connectionResult.accountIds[0];
      const network = this.mapNetwork(connectionResult.network);

      // Create connection object
      this.connection = {
        accountId,
        network,
        isConnected: true,
      };

      // Set up network change listener if supported
      this.setupNetworkChangeListener();

      // Emit connection event
      this.emit('connect', this.connection);

      return this.connection;
    } catch (error) {
      const walletError = this.handleHashPackError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from HashPack wallet
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.hashpack) {
        await this.hashpack.disconnect();
      }

      // Emit disconnect event before cleanup (which clears listeners)
      this.emit('disconnect');
      this.cleanup();
    } catch (error) {
      const walletError = this.handleHashPackError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get account information from HashPack wallet
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      if (!this.connection || !this.hashpack) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'HashPack wallet is not connected'
        );
      }

      const accountInfo = await this.hashpack.getAccountInfo();
      const balance = await this.getBalance();

      return {
        accountId: accountInfo.accountId,
        balance,
        network: this.mapNetwork(accountInfo.network),
      };
    } catch (error) {
      const walletError = this.handleHashPackError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get current balance from HashPack wallet
   */
  public async getBalance(): Promise<string> {
    try {
      if (!this.connection || !this.hashpack) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'HashPack wallet is not connected'
        );
      }

      const balanceResult = await this.hashpack.getAccountBalance(
        this.connection.accountId
      );

      // Convert hbars to string with proper formatting
      return balanceResult.hbars.toString();
    } catch (error) {
      const walletError = this.handleHashPackError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Map HashPack network string to our NetworkType
   */
  private mapNetwork(network: string): NetworkType {
    switch (network.toLowerCase()) {
      case 'mainnet':
        return 'mainnet';
      case 'testnet':
        return 'testnet';
      default:
        // Default to testnet for unknown networks
        return 'testnet';
    }
  }

  /**
   * Handle HashPack-specific errors and convert to WalletError
   */
  private handleHashPackError(error: any): WalletError {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'message' in error
    ) {
      return error as WalletError;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // HashPack-specific error patterns
      if (
        message.includes('user rejected') ||
        message.includes('user denied')
      ) {
        return this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'Connection request was rejected by user'
        );
      }

      if (message.includes('locked') || message.includes('unlock')) {
        return this.createError(
          WalletErrorType.WALLET_LOCKED,
          'HashPack wallet is locked. Please unlock your wallet and try again.'
        );
      }

      if (message.includes('network') || message.includes('wrong network')) {
        return this.createError(
          WalletErrorType.WRONG_NETWORK,
          'HashPack is connected to the wrong network. Please switch to the correct network.'
        );
      }

      if (
        message.includes('not installed') ||
        message.includes('not available')
      ) {
        return this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'HashPack wallet extension is not installed or available'
        );
      }

      return this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        error.message,
        error
      );
    }

    return this.createError(
      WalletErrorType.UNKNOWN_ERROR,
      'An unknown HashPack error occurred',
      error
    );
  }

  /**
   * Set up network change listener for HashPack
   */
  private setupNetworkChangeListener(): void {
    // HashPack may support network change events in future versions
    // For now, we'll implement polling-based network detection
    if (this.hashpack && typeof window !== 'undefined') {
      // Check for network changes periodically
      const checkNetworkChange = async () => {
        try {
          if (this.connection && this.hashpack) {
            const accountInfo = await this.hashpack.getAccountInfo();
            const newNetwork = this.mapNetwork(accountInfo.network);

            if (newNetwork !== this.connection.network) {
              const oldNetwork = this.connection.network;
              this.connection.network = newNetwork;

              // Emit network change event
              this.emit('networkChanged', {
                oldNetwork,
                newNetwork,
                accountId: this.connection.accountId,
              });
            }
          }
        } catch (error) {
          // Silently handle errors in network checking
          console.warn('Error checking HashPack network change:', error);
        }
      };

      // Check every 5 seconds
      const networkCheckInterval = setInterval(checkNetworkChange, 5000);

      // Store interval for cleanup
      (this as any).networkCheckInterval = networkCheckInterval;
    }
  }

  /**
   * Clean up HashPack-specific resources
   */
  protected cleanup(): void {
    super.cleanup();

    // Clear network check interval
    if ((this as any).networkCheckInterval) {
      clearInterval((this as any).networkCheckInterval);
      (this as any).networkCheckInterval = null;
    }

    this.hashpack = null;
  }
}
