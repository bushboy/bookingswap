import { BaseWalletAdapter } from './BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
  NetworkType,
} from '../../types/wallet';

// Blade wallet interface (based on Blade wallet documentation)
interface BladeWallet {
  createAccount(): Promise<{
    accountId: string;
    seedPhrase: string;
    privateKey: string;
    publicKey: string;
    evmAddress: string;
  }>;
  getAccountInfo(): Promise<{
    accountId: string;
    evmAddress: string;
  }>;
  getBalance(): Promise<{
    hbars: number;
  }>;
  associateToken(tokenId: string): Promise<any>;
  transferHbars(toAccountId: string, amount: number): Promise<any>;
  transferTokens(
    tokenId: string,
    toAccountId: string,
    amount: number
  ): Promise<any>;
  contractCallFunction(
    contractId: string,
    functionName: string,
    params: any
  ): Promise<any>;
  sign(messageString: string): Promise<{
    signedMessage: string;
  }>;
  signTransaction(transactionBytes: Uint8Array): Promise<{
    signedTransaction: Uint8Array;
  }>;
  getC14url(
    asset: string,
    account: string,
    amount: string
  ): Promise<{
    url: string;
  }>;
  exchangeGetQuotes(
    sourceCode: string,
    targetCode: string,
    amount: number
  ): Promise<any>;
  swapTokens(
    sourceCode: string,
    targetCode: string,
    amount: number,
    slippage: number
  ): Promise<any>;
}

// Global Blade interface
declare global {
  interface Window {
    bladeWallet?: {
      isAvailable: boolean;
      createAccount(): Promise<{
        accountId: string;
        seedPhrase: string;
        privateKey: string;
        publicKey: string;
        evmAddress: string;
      }>;
      getAccountInfo(): Promise<{
        accountId: string;
        evmAddress: string;
      }>;
      getBalance(): Promise<{
        hbars: number;
      }>;
      associateToken(tokenId: string): Promise<any>;
      transferHbars(toAccountId: string, amount: number): Promise<any>;
      transferTokens(
        tokenId: string,
        toAccountId: string,
        amount: number
      ): Promise<any>;
      contractCallFunction(
        contractId: string,
        functionName: string,
        params: any
      ): Promise<any>;
      sign(messageString: string): Promise<{
        signedMessage: string;
      }>;
      signTransaction(transactionBytes: Uint8Array): Promise<{
        signedTransaction: Uint8Array;
      }>;
      getC14url(
        asset: string,
        account: string,
        amount: string
      ): Promise<{
        url: string;
      }>;
      exchangeGetQuotes(
        sourceCode: string,
        targetCode: string,
        amount: number
      ): Promise<any>;
      swapTokens(
        sourceCode: string,
        targetCode: string,
        amount: number,
        slippage: number
      ): Promise<any>;
    };
  }
}

/**
 * Blade wallet adapter implementation
 * Provides integration with Blade wallet extension
 */
export class BladeAdapter extends BaseWalletAdapter {
  public readonly id = 'blade';
  public readonly name = 'Blade';
  public readonly icon = '/icons/blade.svg'; // Placeholder icon path

  private blade: BladeWallet | null = null;
  private currentAccountId: string | null = null;

  /**
   * Check if Blade wallet is available (extension installed)
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Check if Blade is available in the window object
      return (
        typeof window !== 'undefined' &&
        window.bladeWallet !== undefined &&
        window.bladeWallet.isAvailable === true
      );
    } catch (error) {
      console.warn('Error checking Blade availability:', error);
      return false;
    }
  }

  /**
   * Connect to Blade wallet
   */
  public async connect(): Promise<WalletConnection> {
    try {
      if (!(await this.isAvailable())) {
        throw this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Blade wallet is not installed. Please install the Blade browser extension.'
        );
      }

      this.blade = window.bladeWallet!;

      // For Blade, we need to either create an account or get existing account info
      // First try to get existing account info
      let accountInfo;
      try {
        accountInfo = await this.blade.getAccountInfo();
        this.currentAccountId = accountInfo.accountId;
      } catch (error) {
        // Handle the error properly using the error handler
        throw this.handleBladeError(error);
      }

      if (!this.currentAccountId) {
        throw this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'No valid account found in Blade wallet'
        );
      }

      // Blade typically operates on testnet by default, but we should detect the network
      // For now, we'll assume testnet as Blade is primarily used for development
      const network: NetworkType = 'testnet';

      // Create connection object
      this.connection = {
        accountId: this.currentAccountId,
        network,
        isConnected: true,
      };

      // Set up network change listener if supported
      this.setupNetworkChangeListener();

      // Emit connection event
      this.emit('connect', this.connection);

      return this.connection;
    } catch (error) {
      const walletError = this.handleBladeError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from Blade wallet
   */
  public async disconnect(): Promise<void> {
    try {
      // Blade doesn't have a specific disconnect method like HashPack
      // We just clear our local state

      // Emit disconnect event before cleanup (which clears listeners)
      this.emit('disconnect');
      this.cleanup();
    } catch (error) {
      const walletError = this.handleBladeError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get account information from Blade wallet
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      if (!this.connection || !this.blade) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Blade wallet is not connected'
        );
      }

      const accountInfo = await this.blade.getAccountInfo();
      const balance = await this.getBalance();

      return {
        accountId: accountInfo.accountId,
        balance,
        network: this.connection.network,
      };
    } catch (error) {
      const walletError = this.handleBladeError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get current balance from Blade wallet
   */
  public async getBalance(): Promise<string> {
    try {
      if (!this.connection || !this.blade) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Blade wallet is not connected'
        );
      }

      const balanceResult = await this.blade.getBalance();

      // Convert hbars to string with proper formatting
      return balanceResult.hbars.toString();
    } catch (error) {
      const walletError = this.handleBladeError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Handle Blade-specific errors and convert to WalletError
   */
  private handleBladeError(error: any): WalletError {
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

      // Blade-specific error patterns
      if (
        message.includes('user rejected') ||
        message.includes('user denied') ||
        message.includes('user cancelled')
      ) {
        return this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'Connection request was rejected by user'
        );
      }

      if (
        message.includes('locked') ||
        message.includes('unlock') ||
        message.includes('password')
      ) {
        return this.createError(
          WalletErrorType.WALLET_LOCKED,
          'Blade wallet is locked. Please unlock your wallet and try again.'
        );
      }

      if (message.includes('network') || message.includes('wrong network')) {
        return this.createError(
          WalletErrorType.WRONG_NETWORK,
          'Blade is connected to the wrong network. Please switch to the correct network.'
        );
      }

      if (
        message.includes('not installed') ||
        message.includes('not available') ||
        message.includes('not found')
      ) {
        return this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Blade wallet extension is not installed or available'
        );
      }

      if (
        message.includes('no account') ||
        message.includes('account not found')
      ) {
        return this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'No account found in Blade wallet. Please set up your Blade wallet first.'
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
      'An unknown Blade error occurred',
      error
    );
  }

  /**
   * Set up network change listener for Blade
   */
  private setupNetworkChangeListener(): void {
    // Blade wallet network detection
    // Since Blade primarily uses testnet, we'll implement basic network monitoring
    if (this.blade && typeof window !== 'undefined') {
      // Check for network changes periodically
      const checkNetworkChange = async () => {
        try {
          if (this.connection && this.blade) {
            // Blade doesn't provide direct network info, so we'll monitor account info
            // and detect network changes through account behavior
            const accountInfo = await this.blade.getAccountInfo();

            // For Blade, we'll assume testnet unless we can detect otherwise
            // This is a simplified implementation
            const currentNetwork = this.connection.network;

            // In a real implementation, you might check account ID patterns
            // or other indicators to detect network changes
            // For now, we'll keep the current network
          }
        } catch (error) {
          // Silently handle errors in network checking
          console.warn('Error checking Blade network change:', error);
        }
      };

      // Check every 10 seconds (less frequent than HashPack since Blade is more stable)
      const networkCheckInterval = setInterval(checkNetworkChange, 10000);

      // Store interval for cleanup
      (this as any).networkCheckInterval = networkCheckInterval;
    }
  }

  /**
   * Clean up Blade-specific resources
   */
  protected cleanup(): void {
    super.cleanup();

    // Clear network check interval
    if ((this as any).networkCheckInterval) {
      clearInterval((this as any).networkCheckInterval);
      (this as any).networkCheckInterval = null;
    }

    this.blade = null;
    this.currentAccountId = null;
  }
}
