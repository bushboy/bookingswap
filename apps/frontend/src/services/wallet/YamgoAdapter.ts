import { BaseWalletAdapter } from './BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
  NetworkType,
} from '../../types/wallet';

// Yamgo wallet interface
interface YamgoWallet {
  connect(): Promise<{
    accountId: string;
    network: string;
  }>;
  disconnect(): Promise<void>;
  getBalance(): Promise<{
    hbar: number;
  }>;
  isConnected(): boolean;
  getAccount(): Promise<{
    accountId: string;
    network: string;
  }>;
}

// Global Yamgo interface
declare global {
  interface Window {
    yamgo?: {
      isAvailable: boolean;
      connect(): Promise<{
        accountId: string;
        network: string;
      }>;
      disconnect(): Promise<void>;
      getBalance(): Promise<{
        hbar: number;
      }>;
      isConnected(): boolean;
      getAccount(): Promise<{
        accountId: string;
        network: string;
      }>;
    };
  }
}

/**
 * Yamgo wallet adapter implementation
 * Provides integration with Yamgo wallet
 */
export class YamgoAdapter extends BaseWalletAdapter {
  public readonly id = 'yamgo';
  public readonly name = 'Yamgo Wallet';
  public readonly icon = '/icons/yamgo.svg';

  private yamgo: YamgoWallet | null = null;

  /**
   * Check if Yamgo wallet is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      return (
        typeof window !== 'undefined' &&
        window.yamgo !== undefined &&
        window.yamgo.isAvailable === true
      );
    } catch (error) {
      console.warn('Error checking Yamgo availability:', error);
      return false;
    }
  }

  /**
   * Connect to Yamgo wallet
   */
  public async connect(): Promise<WalletConnection> {
    try {
      if (!(await this.isAvailable())) {
        throw this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Yamgo wallet is not installed. Please install Yamgo wallet extension.'
        );
      }

      this.yamgo = window.yamgo!;

      const connectionResult = await this.yamgo.connect();

      if (!connectionResult.accountId) {
        throw this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'No account found in Yamgo wallet'
        );
      }

      const network = this.mapNetwork(connectionResult.network);

      this.connection = {
        accountId: connectionResult.accountId,
        network,
        isConnected: true,
      };

      this.setupNetworkChangeListener();
      this.emit('connect', this.connection);

      return this.connection;
    } catch (error) {
      const walletError = this.handleYamgoError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from Yamgo wallet
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.yamgo) {
        await this.yamgo.disconnect();
      }

      this.emit('disconnect');
      this.cleanup();
    } catch (error) {
      const walletError = this.handleYamgoError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get account information from Yamgo wallet
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      if (!this.connection || !this.yamgo) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Yamgo wallet is not connected'
        );
      }

      const accountInfo = await this.yamgo.getAccount();
      const balance = await this.getBalance();

      return {
        accountId: accountInfo.accountId,
        balance,
        network: this.mapNetwork(accountInfo.network),
      };
    } catch (error) {
      const walletError = this.handleYamgoError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get current balance from Yamgo wallet
   */
  public async getBalance(): Promise<string> {
    try {
      if (!this.connection || !this.yamgo) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Yamgo wallet is not connected'
        );
      }

      const balanceResult = await this.yamgo.getBalance();
      return balanceResult.hbar.toString();
    } catch (error) {
      const walletError = this.handleYamgoError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Map network string to NetworkType
   */
  private mapNetwork(network: string): NetworkType {
    switch (network.toLowerCase()) {
      case 'mainnet':
        return 'mainnet';
      case 'testnet':
        return 'testnet';
      default:
        return 'testnet';
    }
  }

  /**
   * Handle Yamgo-specific errors
   */
  private handleYamgoError(error: any): WalletError {
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
          'Yamgo wallet is locked. Please unlock your wallet and try again.'
        );
      }

      if (message.includes('network') || message.includes('wrong network')) {
        return this.createError(
          WalletErrorType.WRONG_NETWORK,
          'Yamgo is connected to the wrong network. Please switch to the correct network.'
        );
      }

      if (
        message.includes('not installed') ||
        message.includes('not available')
      ) {
        return this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Yamgo wallet is not installed or available'
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
      'An unknown Yamgo error occurred',
      error
    );
  }

  /**
   * Set up network change listener
   */
  private setupNetworkChangeListener(): void {
    if (this.yamgo && typeof window !== 'undefined') {
      const checkNetworkChange = async () => {
        try {
          if (this.connection && this.yamgo) {
            const accountInfo = await this.yamgo.getAccount();
            const newNetwork = this.mapNetwork(accountInfo.network);

            if (newNetwork !== this.connection.network) {
              const oldNetwork = this.connection.network;
              this.connection.network = newNetwork;

              this.emit('networkChanged', {
                oldNetwork,
                newNetwork,
                accountId: this.connection.accountId,
              });
            }
          }
        } catch (error) {
          console.warn('Error checking Yamgo network change:', error);
        }
      };

      const networkCheckInterval = setInterval(checkNetworkChange, 5000);
      (this as any).networkCheckInterval = networkCheckInterval;
    }
  }

  /**
   * Clean up resources
   */
  protected cleanup(): void {
    super.cleanup();

    if ((this as any).networkCheckInterval) {
      clearInterval((this as any).networkCheckInterval);
      (this as any).networkCheckInterval = null;
    }

    this.yamgo = null;
  }
}
