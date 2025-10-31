import { BaseWalletAdapter } from './BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
  NetworkType,
} from '../../types/wallet';

// Kabila wallet interface
interface KabilaWallet {
  connect(): Promise<{
    accountId: string;
    network: string;
  }>;
  disconnect(): Promise<void>;
  getAccountBalance(): Promise<{
    balance: string;
  }>;
  isConnected(): boolean;
  getAccountInfo(): Promise<{
    accountId: string;
    network: string;
  }>;
  signTransaction(transaction: any): Promise<any>;
}

// Global Kabila interface
declare global {
  interface Window {
    kabila?: {
      isAvailable: boolean;
      connect(): Promise<{
        accountId: string;
        network: string;
      }>;
      disconnect(): Promise<void>;
      getAccountBalance(): Promise<{
        balance: string;
      }>;
      isConnected(): boolean;
      getAccountInfo(): Promise<{
        accountId: string;
        network: string;
      }>;
      signTransaction(transaction: any): Promise<any>;
    };
  }
}

// Kabila-specific diagnostics interface
interface KabilaDiagnostics {
  extensionDetected: boolean;
  extensionVersion?: string;
  isAvailable: boolean;
  isConnected: boolean;
  accountInfo?: {
    accountId: string;
    network: string;
  };
  lastError?: string;
  connectionAttempts: number;
  lastConnectionAttempt?: number;
  healthCheckStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck?: number;
}

/**
 * Kabila wallet adapter implementation
 * Provides integration with Kabila wallet
 */
export class KabilaAdapter extends BaseWalletAdapter {
  public readonly id = 'kabila';
  public readonly name = 'Kabila Wallet';
  public readonly icon = '/icons/kabila.svg';

  private kabila: KabilaWallet | null = null;


  /**
   * Check if Kabila wallet is available (simplified)
   */
  public async isAvailable(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      // Simple synchronous check
      return window.kabila !== undefined &&
        window.kabila !== null &&
        window.kabila.isAvailable === true;
    } catch (error) {
      console.warn('Kabila availability check failed:', error);
      return false;
    }
  }



  /**
   * Perform connection health check
   */
  public async performHealthCheck(): Promise<{
    isHealthy: boolean;
    diagnostics: KabilaDiagnostics;
    issues: string[];
  }> {
    const issues: string[] = [];
    const diagnostics = await this.collectDiagnostics();

    // Check extension detection
    if (!diagnostics.extensionDetected) {
      issues.push('Kabila extension not detected');
    }

    // Check availability
    if (!diagnostics.isAvailable) {
      issues.push('Kabila wallet not available (may be locked)');
    }

    // Check connection consistency
    if (this.connection?.isConnected && !diagnostics.isConnected) {
      issues.push('Connection state mismatch detected');
    }

    // Check account info consistency
    if (this.connection && diagnostics.accountInfo) {
      if (this.connection.accountId !== diagnostics.accountInfo.accountId) {
        issues.push('Account ID mismatch between adapter and extension');
      }
      if (this.connection.network !== diagnostics.accountInfo.network) {
        issues.push('Network mismatch between adapter and extension');
      }
    }

    const isHealthy = issues.length === 0;

    // Update diagnostics with health status
    diagnostics.healthCheckStatus = isHealthy ? 'healthy' :
      issues.length <= 2 ? 'degraded' : 'unhealthy';
    diagnostics.lastHealthCheck = Date.now();

    this.connectionDiagnostics = diagnostics;

    return {
      isHealthy,
      diagnostics,
      issues
    };
  }

  /**
   * Collect comprehensive diagnostic information
   */
  public async collectDiagnostics(): Promise<KabilaDiagnostics> {
    const diagnostics: KabilaDiagnostics = {
      extensionDetected: false,
      isAvailable: false,
      isConnected: false,
      connectionAttempts: 0,
      healthCheckStatus: 'unhealthy'
    };

    try {
      // Check if extension is detected
      diagnostics.extensionDetected = typeof window !== 'undefined' &&
        window.kabila !== undefined;

      if (diagnostics.extensionDetected && window.kabila) {
        // Check availability
        diagnostics.isAvailable = window.kabila.isAvailable === true;

        // Try to get extension version if available
        try {
          // Some extensions expose version info
          diagnostics.extensionVersion = (window.kabila as any).version || 'unknown';
        } catch (e) {
          // Version not available, that's okay
        }

        // Check connection status
        try {
          diagnostics.isConnected = window.kabila.isConnected();
        } catch (e) {
          diagnostics.isConnected = false;
        }

        // Get account info if connected
        if (diagnostics.isConnected) {
          try {
            const accountInfo = await window.kabila.getAccountInfo();
            diagnostics.accountInfo = {
              accountId: accountInfo.accountId,
              network: accountInfo.network
            };
          } catch (e) {
            diagnostics.lastError = `Failed to get account info: ${e instanceof Error ? e.message : 'Unknown error'}`;
          }
        }
      }

      // Add adapter-specific diagnostics
      if (this.connection) {
        diagnostics.connectionAttempts = (this as any).connectionAttempts || 0;
        diagnostics.lastConnectionAttempt = (this as any).lastConnectionAttempt;
      }

    } catch (error) {
      diagnostics.lastError = error instanceof Error ? error.message : 'Unknown diagnostic error';
    }

    return diagnostics;
  }

  /**
   * Start connection health monitoring
   */
  private startHealthMonitoring(): void {
    // Clear existing interval
    if (this.connectionHealthCheckInterval) {
      clearInterval(this.connectionHealthCheckInterval);
    }

    // Start health check interval (every 30 seconds)
    this.connectionHealthCheckInterval = setInterval(async () => {
      try {
        const healthCheck = await this.performHealthCheck();

        // Emit health status changes
        if (!healthCheck.isHealthy) {
          this.emit('healthIssue', {
            issues: healthCheck.issues,
            diagnostics: healthCheck.diagnostics
          });
        }

        // Auto-recovery for certain issues
        if (healthCheck.issues.includes('Connection state mismatch detected')) {
          console.warn('Kabila connection state mismatch detected, attempting recovery');
          await this.recoverConnectionState();
        }

      } catch (error) {
        console.warn('Health check failed:', error);
      }
    }, 30000);
  }

  /**
   * Stop connection health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.connectionHealthCheckInterval) {
      clearInterval(this.connectionHealthCheckInterval);
      this.connectionHealthCheckInterval = null;
    }
  }

  /**
   * Attempt to recover connection state
   */
  private async recoverConnectionState(): Promise<void> {
    try {
      if (!window.kabila) {
        return;
      }

      const isExtensionConnected = window.kabila.isConnected();
      const hasAdapterConnection = this.connection?.isConnected;

      if (hasAdapterConnection && !isExtensionConnected) {
        // Adapter thinks it's connected but extension doesn't
        console.warn('Adapter connection state out of sync, disconnecting');
        await this.disconnect();
      } else if (!hasAdapterConnection && isExtensionConnected) {
        // Extension is connected but adapter doesn't know
        console.warn('Extension connected but adapter not aware, syncing state');
        try {
          const accountInfo = await window.kabila.getAccountInfo();
          this.connection = {
            accountId: accountInfo.accountId,
            network: this.mapNetwork(accountInfo.network),
            isConnected: true
          };
          this.kabila = window.kabila;
          this.emit('connect', this.connection);
        } catch (error) {
          console.warn('Failed to sync connection state:', error);
        }
      }
    } catch (error) {
      console.warn('Connection state recovery failed:', error);
    }
  }

  /**
   * Get current diagnostics (cached or fresh)
   */
  public getDiagnostics(): KabilaDiagnostics | null {
    return this.connectionDiagnostics;
  }

  /**
   * Validate current connection state
   */
  public async validateConnectionState(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const diagnostics = await this.collectDiagnostics();

      // Check basic extension availability
      if (!diagnostics.extensionDetected) {
        issues.push('Kabila extension not detected');
        recommendations.push('Install Kabila wallet extension from Chrome Web Store');
      }

      if (!diagnostics.isAvailable) {
        issues.push('Kabila wallet not available');
        recommendations.push('Unlock your Kabila wallet');
      }

      // Check connection consistency
      if (this.connection?.isConnected) {
        if (!diagnostics.isConnected) {
          issues.push('Adapter shows connected but extension shows disconnected');
          recommendations.push('Reconnect your wallet');
        }

        if (diagnostics.accountInfo) {
          if (this.connection.accountId !== diagnostics.accountInfo.accountId) {
            issues.push('Account ID mismatch');
            recommendations.push('Reconnect to sync account information');
          }
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      return {
        isValid: false,
        issues: ['Failed to validate connection state'],
        recommendations: ['Try refreshing the page and reconnecting']
      };
    }
  }

  /**
   * Connect to Kabila wallet
   */
  public async connect(): Promise<WalletConnection> {
    // Track connection attempt
    (this as any).connectionAttempts = ((this as any).connectionAttempts || 0) + 1;
    (this as any).lastConnectionAttempt = Date.now();

    try {
      if (!(await this.isAvailable())) {
        throw this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Kabila wallet is not installed. Please install Kabila wallet or use the web version.'
        );
      }

      this.kabila = window.kabila!;

      const connectionResult = await this.kabila.connect();

      if (!connectionResult.accountId) {
        throw this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'No account found in Kabila wallet'
        );
      }

      const network = this.mapNetwork(connectionResult.network);

      this.connection = {
        accountId: connectionResult.accountId,
        network,
        isConnected: true,
      };

      this.setupNetworkChangeListener();

      // Save connection state for persistence
      this.saveConnectionState();

      this.emit('connect', this.connection);

      return this.connection;
    } catch (error) {
      const walletError = this.handleKabilaError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from Kabila wallet
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.kabila) {
        await this.kabila.disconnect();
      }



      // Clear stored connection state
      this.clearStoredConnection();

      this.emit('disconnect');
      this.cleanup();
    } catch (error) {
      const walletError = this.handleKabilaError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get account information from Kabila wallet
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    try {
      if (!this.connection || !this.kabila) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Kabila wallet is not connected'
        );
      }

      const accountInfo = await this.kabila.getAccountInfo();
      const balance = await this.getBalance();

      return {
        accountId: accountInfo.accountId,
        balance,
        network: this.mapNetwork(accountInfo.network),
      };
    } catch (error) {
      const walletError = this.handleKabilaError(error);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get current balance from Kabila wallet
   */
  public async getBalance(): Promise<string> {
    try {
      if (!this.connection || !this.kabila) {
        throw this.createError(
          WalletErrorType.UNKNOWN_ERROR,
          'Kabila wallet is not connected'
        );
      }

      const balanceResult = await this.kabila.getAccountBalance();
      return balanceResult.balance;
    } catch (error) {
      const walletError = this.handleKabilaError(error);
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
   * Handle Kabila-specific errors with enhanced categorization
   */
  private handleKabilaError(error: any): WalletError {
    // If already a WalletError, return as-is
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'message' in error
    ) {
      return error as WalletError;
    }

    // Handle extension not available/installed
    if (!window.kabila) {
      return this.createError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        'Kabila wallet extension is not installed. Please install the Kabila wallet extension from the Chrome Web Store and refresh the page.',
        {
          installUrl: 'https://chrome.google.com/webstore/detail/kabila-wallet',
          recoveryAction: 'install_extension'
        }
      );
    }

    // Handle extension locked state
    if (window.kabila && window.kabila.isAvailable === false) {
      return this.createError(
        WalletErrorType.WALLET_LOCKED,
        'Kabila wallet is locked. Please unlock your wallet by clicking on the Kabila extension icon and entering your password.',
        {
          recoveryAction: 'unlock_wallet',
          troubleshooting: 'Click the Kabila extension icon in your browser toolbar and enter your password'
        }
      );
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const stack = error.stack || '';

      // Connection rejected by user
      if (
        message.includes('user rejected') ||
        message.includes('user denied') ||
        message.includes('user cancelled') ||
        message.includes('rejected by user')
      ) {
        return this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'Connection request was rejected. Please try connecting again and approve the connection request in your Kabila wallet.',
          {
            recoveryAction: 'retry_connection',
            userAction: 'Click "Connect" and approve the connection request in the Kabila wallet popup'
          }
        );
      }

      // Wallet locked errors
      if (
        message.includes('locked') ||
        message.includes('unlock') ||
        message.includes('password required') ||
        message.includes('authentication required')
      ) {
        return this.createError(
          WalletErrorType.WALLET_LOCKED,
          'Kabila wallet is locked. Please unlock your wallet and try again.',
          {
            recoveryAction: 'unlock_wallet',
            troubleshooting: 'Open the Kabila extension and enter your password to unlock'
          }
        );
      }

      // Network-related errors
      if (
        message.includes('network') ||
        message.includes('wrong network') ||
        message.includes('unsupported network') ||
        message.includes('network mismatch')
      ) {
        return this.createError(
          WalletErrorType.WRONG_NETWORK,
          'Kabila wallet is connected to an unsupported network. Please switch to Hedera Mainnet or Testnet.',
          {
            recoveryAction: 'switch_network',
            supportedNetworks: ['mainnet', 'testnet'],
            troubleshooting: 'Open Kabila wallet settings and switch to the correct Hedera network'
          }
        );
      }

      // Extension not installed/available
      if (
        message.includes('not installed') ||
        message.includes('not available') ||
        message.includes('extension not found') ||
        message.includes('kabila is not defined')
      ) {
        return this.createError(
          WalletErrorType.PROVIDER_NOT_FOUND,
          'Kabila wallet extension is not installed or not properly loaded. Please install or refresh the page.',
          {
            installUrl: 'https://chrome.google.com/webstore/detail/kabila-wallet',
            recoveryAction: 'install_or_refresh',
            troubleshooting: 'Install the extension or refresh the page if already installed'
          }
        );
      }

      // Connection timeout errors
      if (
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('connection timeout')
      ) {
        return this.createError(
          WalletErrorType.NETWORK_ERROR,
          'Connection to Kabila wallet timed out. Please check your internet connection and try again.',
          {
            recoveryAction: 'retry_with_delay',
            troubleshooting: 'Check internet connection and ensure Kabila extension is responsive'
          }
        );
      }

      // Account-related errors
      if (
        message.includes('no account') ||
        message.includes('account not found') ||
        message.includes('no accounts available')
      ) {
        return this.createError(
          WalletErrorType.CONNECTION_REJECTED,
          'No accounts found in Kabila wallet. Please create or import an account first.',
          {
            recoveryAction: 'setup_account',
            troubleshooting: 'Open Kabila wallet and create or import a Hedera account'
          }
        );
      }

      // Generic error with enhanced details
      return this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        `Kabila wallet error: ${error.message}`,
        {
          originalError: error.message,
          stack: stack.substring(0, 500), // Limit stack trace length
          recoveryAction: 'retry_or_refresh',
          troubleshooting: 'Try refreshing the page or restarting your browser'
        }
      );
    }

    // Handle non-Error objects
    const errorString = typeof error === 'string' ? error : JSON.stringify(error);
    return this.createError(
      WalletErrorType.UNKNOWN_ERROR,
      `An unexpected Kabila error occurred: ${errorString}`,
      {
        originalError: error,
        recoveryAction: 'retry_or_refresh',
        troubleshooting: 'Try refreshing the page or restarting your browser'
      }
    );
  }

  /**
   * Get error recovery strategy based on error type
   */
  public getErrorRecoveryStrategy(error: WalletError): {
    canRetry: boolean;
    retryDelay?: number;
    maxRetries?: number;
    userAction?: string;
  } {
    switch (error.type) {
      case WalletErrorType.PROVIDER_NOT_FOUND:
        return {
          canRetry: false,
          userAction: 'Install Kabila wallet extension'
        };

      case WalletErrorType.WALLET_LOCKED:
        return {
          canRetry: true,
          retryDelay: 2000,
          maxRetries: 3,
          userAction: 'Unlock your Kabila wallet'
        };

      case WalletErrorType.CONNECTION_REJECTED:
        return {
          canRetry: true,
          retryDelay: 1000,
          maxRetries: 2,
          userAction: 'Approve the connection request'
        };

      case WalletErrorType.NETWORK_ERROR:
        return {
          canRetry: true,
          retryDelay: 3000,
          maxRetries: 3,
          userAction: 'Check your internet connection'
        };

      case WalletErrorType.WRONG_NETWORK:
        return {
          canRetry: true,
          retryDelay: 2000,
          maxRetries: 2,
          userAction: 'Switch to the correct network in Kabila'
        };

      default:
        return {
          canRetry: true,
          retryDelay: 2000,
          maxRetries: 1,
          userAction: 'Try again or refresh the page'
        };
    }
  }

  /**
   * Set up network change listener
   */
  private setupNetworkChangeListener(): void {
    if (this.kabila && typeof window !== 'undefined') {
      const checkNetworkChange = async () => {
        try {
          if (this.connection && this.kabila) {
            const accountInfo = await this.kabila.getAccountInfo();
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
          console.warn('Error checking Kabila network change:', error);
        }
      };

      const networkCheckInterval = setInterval(checkNetworkChange, 5000);
      (this as any).networkCheckInterval = networkCheckInterval;
    }
  }

  /**
   * Save connection state to localStorage for persistence
   */
  private saveConnectionState(): void {
    if (!this.connection) return;

    try {
      const connectionData = {
        accountId: this.connection.accountId,
        network: this.connection.network,
        timestamp: Date.now(),
        adapterVersion: '1.0.0' // Version for compatibility checking
      };

      localStorage.setItem('kabila_connection_state', JSON.stringify(connectionData));
    } catch (error) {
      console.warn('Failed to save Kabila connection state:', error);
    }
  }

  /**
   * Load connection state from localStorage
   */
  private loadConnectionState(): {
    accountId: string;
    network: NetworkType;
    timestamp: number;
  } | null {
    try {
      const stored = localStorage.getItem('kabila_connection_state');
      if (!stored) return null;

      const connectionData = JSON.parse(stored);

      // Check if stored data is recent (within 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - connectionData.timestamp > maxAge) {
        localStorage.removeItem('kabila_connection_state');
        return null;
      }

      return connectionData;
    } catch (error) {
      console.warn('Failed to load Kabila connection state:', error);
      localStorage.removeItem('kabila_connection_state');
      return null;
    }
  }

  /**
   * Attempt to restore previous connection
   */
  public async restoreConnection(): Promise<WalletConnection | null> {
    try {
      // Check if extension is available
      if (!(await this.isAvailable())) {
        return null;
      }

      // Load stored connection state
      const storedState = this.loadConnectionState();
      if (!storedState) {
        return null;
      }

      // Check if extension is still connected
      if (!window.kabila || !window.kabila.isConnected()) {
        // Clear invalid stored state
        localStorage.removeItem('kabila_connection_state');
        return null;
      }

      // Verify the connection matches stored state
      const currentAccountInfo = await window.kabila.getAccountInfo();
      if (currentAccountInfo.accountId !== storedState.accountId) {
        // Account changed, clear stored state
        localStorage.removeItem('kabila_connection_state');
        return null;
      }

      // Restore connection
      this.kabila = window.kabila;
      this.connection = {
        accountId: storedState.accountId,
        network: this.mapNetwork(currentAccountInfo.network),
        isConnected: true
      };

      // Start monitoring and setup listeners
      this.startHealthMonitoring();
      this.setupNetworkChangeListener();

      // Collect diagnostics
      this.connectionDiagnostics = await this.collectDiagnostics();

      this.emit('connect', this.connection);

      return this.connection;
    } catch (error) {
      console.warn('Failed to restore Kabila connection:', error);
      localStorage.removeItem('kabila_connection_state');
      return null;
    }
  }

  /**
   * Clear stored connection state
   */
  public clearStoredConnection(): void {
    try {
      localStorage.removeItem('kabila_connection_state');
    } catch (error) {
      console.warn('Failed to clear stored Kabila connection:', error);
    }
  }

  /**
   * Get current connection state for service synchronization
   */
  public getConnection(): WalletConnection | null {
    return this.connection;
  }

  /**
   * Check if adapter is currently connected
   */
  public isConnected(): boolean {
    return this.connection?.isConnected ?? false;
  }

  /**
   * Sync connection state with extension
   * Used by WalletService for state synchronization
   */
  public async syncConnectionState(): Promise<boolean> {
    try {
      if (!window.kabila) {
        // Extension not available, clear connection if we have one
        if (this.connection?.isConnected) {
          this.connection = null;
          this.clearStoredConnection();
          this.emit('disconnect');
          return false;
        }
        return false;
      }

      const isExtensionConnected = window.kabila.isConnected();
      const hasAdapterConnection = this.connection?.isConnected;

      if (hasAdapterConnection && !isExtensionConnected) {
        // Adapter thinks it's connected but extension doesn't
        console.warn('Kabila adapter connection out of sync, disconnecting');
        this.connection = null;
        this.clearStoredConnection();
        this.emit('disconnect');
        return false;
      }

      if (!hasAdapterConnection && isExtensionConnected) {
        // Extension is connected but adapter doesn't know
        console.warn('Kabila extension connected but adapter not aware, syncing state');
        try {
          const accountInfo = await window.kabila.getAccountInfo();
          this.connection = {
            accountId: accountInfo.accountId,
            network: this.mapNetwork(accountInfo.network),
            isConnected: true
          };
          this.kabila = window.kabila;
          this.saveConnectionState();
          this.emit('connect', this.connection);
          return true;
        } catch (error) {
          console.warn('Failed to sync Kabila connection state:', error);
          return false;
        }
      }

      // States are in sync
      return hasAdapterConnection || false;
    } catch (error) {
      console.warn('Kabila connection state sync failed:', error);
      return false;
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



    this.kabila = null;
  }
}
