import { BaseWalletAdapter } from './BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
  NetworkType,
} from '../../types/wallet';
import { WALLET_CONFIG } from '../../config/wallet';

/**
 * Mock wallet adapter for testing and development
 * Simulates wallet behavior without requiring actual wallet installation
 */
export class MockWalletAdapter extends BaseWalletAdapter {
  public readonly id = 'mock';
  public readonly name = 'Mock Wallet (Testing)';
  public readonly icon = '/icons/mock-wallet.svg';

  private mockAccountId = WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT;
  private mockBalance = WALLET_CONFIG.DEFAULT_BALANCE.toString();
  private mockNetwork: NetworkType = WALLET_CONFIG.NETWORK as NetworkType;
  private isConnectedState = false;

  /**
   * Mock wallet is always available for testing (synchronous)
   */
  public async isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /**
   * Simulate wallet connection
   */
  public async connect(): Promise<WalletConnection> {
    try {
      // Simulate minimal connection delay for development
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate user approval (90% success rate for testing)
      if (Math.random() < 0.1) {
        throw this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'User rejected the connection request'
        );
      }

      this.isConnectedState = true;

      this.connection = {
        accountId: this.mockAccountId,
        network: this.mockNetwork,
        isConnected: true,
      };

      this.emit('connect', this.connection);
      return this.connection;
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        this.emit('error', error as WalletError);
        throw error;
      }

      const walletError = this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        'Mock wallet connection failed',
        error
      );
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Simulate wallet disconnection
   */
  public async disconnect(): Promise<void> {
    try {
      // Simulate disconnection delay
      await new Promise(resolve => setTimeout(resolve, 500));

      this.isConnectedState = false;
      this.emit('disconnect');
      this.cleanup();
    } catch (error) {
      const walletError = this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        'Mock wallet disconnection failed',
        error
      );
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get mock account information
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      if (!this.connection || !this.isConnectedState) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Mock wallet is not connected'
        );
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      return {
        accountId: this.mockAccountId,
        balance: this.mockBalance,
        network: this.mockNetwork,
      };
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        this.emit('error', error as WalletError);
        throw error;
      }

      const walletError = this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        'Failed to get mock account info',
        error
      );
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get mock balance
   */
  public async getBalance(): Promise<string> {
    try {
      if (!this.connection || !this.isConnectedState) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Mock wallet is not connected'
        );
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));

      // Simulate balance fluctuation for testing
      const baseBalance = parseFloat(this.mockBalance);
      const fluctuation = (Math.random() - 0.5) * 10; // ±5 HBAR
      const newBalance = Math.max(0, baseBalance + fluctuation);

      this.mockBalance = newBalance.toFixed(2);
      return this.mockBalance;
    } catch (error) {
      const walletError = this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        'Failed to get mock balance',
        error
      );
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Simulate network switching for testing
   */
  public async switchNetwork(network: NetworkType): Promise<void> {
    try {
      if (!this.connection || !this.isConnectedState) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Mock wallet is not connected'
        );
      }

      // Simulate network switch delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const oldNetwork = this.mockNetwork;
      this.mockNetwork = network;

      if (this.connection) {
        this.connection.network = network;
      }

      this.emit('networkChanged', {
        oldNetwork,
        newNetwork: network,
        accountId: this.mockAccountId,
      });
    } catch (error) {
      const walletError = this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        'Failed to switch mock network',
        error
      );
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Simulate transaction signing for testing
   */
  public async signTransaction(transaction: any): Promise<any> {
    try {
      if (!this.connection || !this.isConnectedState) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Mock wallet is not connected'
        );
      }

      // Simulate signing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate user approval (95% success rate)
      if (Math.random() < 0.05) {
        throw this.createError(
          WalletErrorType.TRANSACTION_REJECTED,
          'User rejected the transaction'
        );
      }

      // Return mock signed transaction
      return {
        ...transaction,
        signature: 'mock_signature_' + Date.now(),
        signedAt: new Date().toISOString(),
        accountId: this.mockAccountId,
      };
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        this.emit('error', error as WalletError);
        throw error;
      }

      const walletError = this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        'Failed to sign mock transaction',
        error
      );
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Set mock account for testing different scenarios
   */
  public setMockAccount(
    accountId: string,
    balance: string,
    network: NetworkType = 'testnet'
  ): void {
    this.mockAccountId = accountId;
    this.mockBalance = balance;
    this.mockNetwork = network;

    if (this.connection) {
      this.connection.accountId = accountId;
      this.connection.network = network;
    }
  }

  /**
   * Simulate wallet lock for testing error scenarios
   */
  public simulateWalletLock(): void {
    this.isConnectedState = false;
    const error = this.createError(
      WalletErrorType.WALLET_LOCKED,
      'Mock wallet has been locked'
    );
    this.emit('error', error);
  }

  /**
   * Simulate network error for testing
   */
  public simulateNetworkError(): void {
    const error = this.createError(
      WalletErrorType.NETWORK_ERROR,
      'Mock network error occurred'
    );
    this.emit('error', error);
  }

  /**
   * Clean up mock wallet resources
   */
  protected cleanup(): void {
    super.cleanup();
    this.isConnectedState = false;
  }
}
