import {
  WalletProvider,
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
} from '../../types/wallet';
import {
  createWalletError,
  WalletErrorHandler,
} from '../../utils/walletErrorHandling';

/**
 * Abstract base class for wallet adapters
 * Provides common functionality and enforces interface implementation
 */
export abstract class BaseWalletAdapter implements WalletProvider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly icon: string;

  protected connection: WalletConnection | null = null;
  protected listeners: Map<string, Function[]> = new Map();

  /**
   * Check if the wallet provider is available (extension installed, etc.)
   */
  public abstract isAvailable(): Promise<boolean>;

  /**
   * Connect to the wallet provider
   */
  public abstract connect(): Promise<WalletConnection>;

  /**
   * Disconnect from the wallet provider
   */
  public abstract disconnect(): Promise<void>;

  /**
   * Get account information from the connected wallet
   */
  public abstract getAccountInfo(): Promise<AccountInfo>;

  /**
   * Get the current balance from the connected wallet
   */
  public abstract getBalance(): Promise<string>;

  /**
   * Get the current connection status
   */
  public getConnection(): WalletConnection | null {
    return this.connection;
  }

  /**
   * Check if wallet is currently connected
   */
  public isConnected(): boolean {
    return this.connection?.isConnected ?? false;
  }

  /**
   * Add event listener for wallet events
   */
  public addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  protected emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in wallet event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Create a standardized wallet error
   */
  protected createError(
    type: WalletErrorType,
    message: string,
    details?: any
  ): WalletError {
    return createWalletError(type, message, details);
  }

  /**
   * Handle common error scenarios and convert to WalletError
   */
  protected handleError(error: any): WalletError {
    return WalletErrorHandler.handleConnectionError(error, this.id);
  }

  /**
   * Handle provider-specific errors
   */
  protected handleProviderError(error: Error): WalletError {
    return WalletErrorHandler.handleProviderError(error, this.id);
  }

  /**
   * Handle network-related errors
   */
  protected handleNetworkError(
    error: Error,
    expectedNetwork?: string
  ): WalletError {
    return WalletErrorHandler.handleNetworkError(error, expectedNetwork);
  }

  /**
   * Handle account-related errors
   */
  protected handleAccountError(error: Error): WalletError {
    return WalletErrorHandler.handleAccountError(error);
  }

  /**
   * Validate network compatibility
   */
  protected validateNetwork(
    network: string,
    expectedNetwork?: string
  ): boolean {
    if (!expectedNetwork) return true;
    return network === expectedNetwork;
  }

  /**
   * Clean up resources when disconnecting
   */
  protected cleanup(): void {
    this.connection = null;
    this.listeners.clear();
  }
}
