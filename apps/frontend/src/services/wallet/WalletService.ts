import {
  WalletProvider,
  WalletConnection,
  AccountInfo,
  WalletError,
  WalletErrorType,
  WalletPreferences,
  NetworkType,
} from '../../types/wallet';
import {
  WalletErrorHandler,
  createWalletRetryHandler,
  createWalletError,
  isWalletError,
} from '../../utils/walletErrorHandling';
import { WalletStorage } from '../../utils/walletStorage';
import {
  NetworkValidator,
  NetworkValidationResult,
  defaultNetworkConfig,
} from './NetworkValidator';

/**
 * Central wallet service that manages multiple wallet providers
 * Provides a unified interface for wallet operations
 */
export class WalletService {
  private providers: Map<string, WalletProvider> = new Map();
  private currentProvider: WalletProvider | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private networkValidator: NetworkValidator;
  private availabilityCache: Map<string, { result: boolean; timestamp: number }> = new Map();
  private readonly AVAILABILITY_CACHE_DURATION = 5000; // 5 seconds

  constructor() {
    this.networkValidator = new NetworkValidator(defaultNetworkConfig);

    // Set up network validator event listeners
    this.networkValidator.addEventListener(
      'networkValidated',
      (result: NetworkValidationResult) => {
        this.emit('networkValidated', result);
      }
    );
  }

  /**
   * Register a wallet provider
   */
  public registerProvider(provider: WalletProvider): void {
    // Validate provider before registration
    if (!provider.id || !provider.name) {
      throw new Error('Provider must have valid id and name');
    }

    if (this.providers.has(provider.id)) {
      console.warn(
        `Provider ${provider.id} is already registered, replacing existing provider`
      );
    }

    this.providers.set(provider.id, provider);

    // Set up provider event listeners
    if (
      'addEventListener' in provider &&
      typeof provider.addEventListener === 'function'
    ) {
      provider.addEventListener('disconnect', () => {
        if (this.currentProvider?.id === provider.id) {
          this.currentProvider = null;
          this.emit('disconnect');
        }
      });

      provider.addEventListener(
        'accountChanged',
        (accountInfo: AccountInfo) => {
          this.emit('accountChanged', accountInfo);
        }
      );

      provider.addEventListener('networkChanged', (network: string) => {
        this.emit('networkChanged', network);
      });
    }

    // Emit provider registration event
    this.emit('providerRegistered', provider.id);
  }

  /**
   * Unregister a wallet provider
   */
  public async unregisterProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return;
    }

    // Disconnect if this is the current provider
    if (this.currentProvider?.id === providerId) {
      try {
        await this.disconnect();
      } catch (error) {
        console.warn(
          `Error disconnecting provider ${providerId} during unregistration:`,
          error
        );
      }
    }

    this.providers.delete(providerId);
    this.emit('providerUnregistered', providerId);
  }

  /**
   * Check if a provider is registered
   */
  public isProviderRegistered(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Get the number of registered providers
   */
  public getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * Get provider IDs
   */
  public getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers
   */
  public getProviders(): WalletProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get available providers (those that are installed/accessible)
   */
  public async getAvailableProviders(): Promise<WalletProvider[]> {
    const providers = this.getProviders();
    const availableProviders: WalletProvider[] = [];

    // Use Promise.allSettled for better error handling and parallel execution
    const availabilityChecks = await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          // Use cached availability if available for Kabila
          const isAvailable = await this.checkProviderAvailabilityWithCache(provider);
          return { provider, isAvailable };
        } catch (error) {
          console.warn(
            `Error checking availability for provider ${provider.id}:`,
            error
          );
          return { provider, isAvailable: false };
        }
      })
    );

    // Process results
    for (const result of availabilityChecks) {
      if (result.status === 'fulfilled' && result.value.isAvailable) {
        availableProviders.push(result.value.provider);
      } else if (result.status === 'rejected') {
        console.warn('Provider availability check failed:', result.reason);
      }
    }

    return availableProviders;
  }

  /**
   * Get provider availability status for all registered providers
   */
  public async getProviderAvailabilityStatus(): Promise<Map<string, boolean>> {
    const providers = this.getProviders();
    const availabilityStatus = new Map<string, boolean>();

    // Use Promise.allSettled for better error handling
    const statusChecks = await Promise.allSettled(
      providers.map(async provider => {
        try {
          const isAvailable = await this.checkProviderAvailabilityWithCache(provider);
          return { providerId: provider.id, isAvailable };
        } catch (error) {
          console.warn(
            `Error checking availability for provider ${provider.id}:`,
            error
          );
          return { providerId: provider.id, isAvailable: false };
        }
      })
    );

    // Process results
    for (const result of statusChecks) {
      if (result.status === 'fulfilled') {
        availabilityStatus.set(result.value.providerId, result.value.isAvailable);
      } else {
        console.warn('Provider availability status check failed:', result.reason);
      }
    }

    return availabilityStatus;
  }

  /**
   * Check if a specific provider is available
   */
  public async isProviderAvailable(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }

    try {
      return await this.checkProviderAvailabilityWithCache(provider);
    } catch (error) {
      console.warn(
        `Error checking availability for provider ${providerId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Check provider availability with caching mechanism
   */
  private async checkProviderAvailabilityWithCache(provider: WalletProvider): Promise<boolean> {
    const now = Date.now();
    const cached = this.availabilityCache.get(provider.id);

    // Return cached result if still valid
    if (cached && (now - cached.timestamp) < this.AVAILABILITY_CACHE_DURATION) {
      return cached.result;
    }

    try {
      // For Kabila adapter, use enhanced availability detection
      let isAvailable: boolean;

      if (provider.id === 'kabila') {
        // Call the enhanced isAvailable method which includes retry logic
        isAvailable = await provider.isAvailable();
      } else {
        // For other providers, use standard availability check
        isAvailable = await provider.isAvailable();
      }

      // Cache the result
      this.availabilityCache.set(provider.id, {
        result: isAvailable,
        timestamp: now
      });

      return isAvailable;
    } catch (error) {
      // Cache negative result for shorter duration on error
      this.availabilityCache.set(provider.id, {
        result: false,
        timestamp: now
      });

      throw error;
    }
  }

  /**
   * Clear availability cache for a specific provider or all providers
   */
  public clearAvailabilityCache(providerId?: string): void {
    if (providerId) {
      this.availabilityCache.delete(providerId);
    } else {
      this.availabilityCache.clear();
    }
  }

  /**
   * Get a specific provider by ID
   */
  public getProvider(providerId: string): WalletProvider | null {
    return this.providers.get(providerId) || null;
  }

  /**
   * Get the currently connected provider
   */
  public getCurrentProvider(): WalletProvider | null {
    return this.currentProvider;
  }

  /**
   * Connect to a specific wallet provider with retry logic
   */
  public async connect(providerId: string): Promise<WalletConnection> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw createWalletError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        `Provider ${providerId} not found`
      );
    }

    const retryHandler = createWalletRetryHandler('connection');

    try {
      return await retryHandler(async () => {
        // Clear availability cache for this provider to ensure fresh check
        this.clearAvailabilityCache(providerId);

        // Check if provider is available with enhanced detection
        const isAvailable = await this.checkProviderAvailabilityWithCache(provider);
        if (!isAvailable) {
          throw WalletErrorHandler.handleProviderError(
            new Error(`${provider.name} is not installed or available`),
            providerId
          );
        }

        // Disconnect current provider if different
        if (this.currentProvider && this.currentProvider.id !== providerId) {
          await this.disconnect();
        }

        // Emit connection starting event
        this.emit('connectionStarting', { providerId, providerName: provider.name });

        // Connect to the new provider
        const connection = await provider.connect();

        // Set current provider immediately after successful connection
        this.currentProvider = provider;

        // Validate network before completing connection
        const networkValidation = this.networkValidator.validateNetwork(
          connection.network
        );

        if (!networkValidation.isValid && networkValidation.error) {
          this.emit('networkValidationFailed', {
            connection,
            validation: networkValidation,
            providerId,
          });
          throw networkValidation.error;
        }

        // Store connection and preferences
        this.saveConnectionData(connection, providerId);

        // Get and store account info with enhanced error handling
        try {
          const accountInfo = await provider.getAccountInfo();
          WalletStorage.saveAccountInfo(accountInfo);

          // For Kabila, set up connection state synchronization
          if (providerId === 'kabila') {
            this.setupKabilaConnectionSync(provider);
          }
        } catch (error) {
          console.warn('Failed to get account info:', error);
          // Don't fail the connection for account info errors
        }

        // Emit events in proper order
        this.emit('connect', connection);
        this.emit('providerChanged', providerId);
        this.emit('connectionCompleted', { providerId, connection });

        return connection;
      });
    } catch (error) {
      // Clear current provider on connection failure
      if (this.currentProvider?.id === providerId) {
        this.currentProvider = null;
      }

      const walletError = isWalletError(error)
        ? error
        : WalletErrorHandler.handleConnectionError(error as Error, providerId);

      this.emit('error', walletError);
      this.emit('connectionFailed', { providerId, error: walletError });
      throw walletError;
    }
  }

  /**
   * Switch to a different wallet provider
   * This will disconnect the current provider and connect to the new one
   */
  public async switchProvider(providerId: string): Promise<WalletConnection> {
    if (this.currentProvider?.id === providerId) {
      // Already connected to this provider, return current connection
      const connection = this.getConnection();
      if (connection) {
        return connection;
      }
    }

    // Emit provider switching event
    this.emit('providerSwitching', {
      from: this.currentProvider?.id || null,
      to: providerId,
    });

    try {
      const connection = await this.connect(providerId);
      this.emit('providerSwitched', {
        from: this.currentProvider?.id || null,
        to: providerId,
      });
      return connection;
    } catch (error) {
      this.emit('providerSwitchFailed', {
        from: this.currentProvider?.id || null,
        to: providerId,
        error,
      });
      throw error;
    }
  }

  /**
   * Disconnect from the current wallet provider
   */
  public async disconnect(): Promise<void> {
    if (!this.currentProvider) {
      return;
    }

    const providerId = this.currentProvider.id;

    try {
      // Stop Kabila-specific monitoring if applicable
      if (providerId === 'kabila') {
        this.stopKabilaConnectionValidation();
      }

      // Emit disconnection starting event
      this.emit('disconnectionStarting', { providerId });

      // Disconnect from provider
      await this.currentProvider.disconnect();

      // Clear state
      this.currentProvider = null;
      this.clearConnectionData();

      // Clear availability cache for this provider
      this.clearAvailabilityCache(providerId);

      // Emit disconnection events
      this.emit('disconnect');
      this.emit('disconnectionCompleted', { providerId });
    } catch (error) {
      const walletError = this.handleError(error);
      this.emit('error', walletError);
      this.emit('disconnectionFailed', { providerId, error: walletError });
      throw walletError;
    }
  }

  /**
   * Get account information from the current provider with retry logic
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    if (!this.currentProvider) {
      throw createWalletError(
        WalletErrorType.UNKNOWN_ERROR,
        'No wallet connected'
      );
    }

    const retryHandler = createWalletRetryHandler('accountInfo');

    try {
      return await retryHandler(async () => {
        return await this.currentProvider!.getAccountInfo();
      });
    } catch (error) {
      const walletError = isWalletError(error)
        ? error
        : WalletErrorHandler.handleAccountError(error as Error);

      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Get balance from the current provider with retry logic
   */
  public async getBalance(): Promise<string> {
    if (!this.currentProvider) {
      throw createWalletError(
        WalletErrorType.UNKNOWN_ERROR,
        'No wallet connected'
      );
    }

    const retryHandler = createWalletRetryHandler('balance');

    try {
      return await retryHandler(async () => {
        return await this.currentProvider!.getBalance();
      });
    } catch (error) {
      const walletError = isWalletError(error)
        ? error
        : WalletErrorHandler.handleAccountError(error as Error);

      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Check if wallet has sufficient balance to cover the specified amount
   * @param requiredAmount - The amount needed (in HBAR or smallest unit)
   * @returns Object indicating if balance is sufficient and current balance
   */
  public async checkSufficientBalance(requiredAmount: number): Promise<{
    isSufficient: boolean;
    currentBalance: number;
    requiredAmount: number;
    shortfall?: number;
  }> {
    try {
      const balanceStr = await this.getBalance();
      const currentBalance = parseFloat(balanceStr);

      if (isNaN(currentBalance)) {
        throw createWalletError(
          WalletErrorType.UNKNOWN_ERROR,
          'Unable to parse wallet balance'
        );
      }

      const isSufficient = currentBalance >= requiredAmount;
      const shortfall = isSufficient ? undefined : requiredAmount - currentBalance;

      return {
        isSufficient,
        currentBalance,
        requiredAmount,
        shortfall,
      };
    } catch (error) {
      // If we can't get balance, assume insufficient
      throw error;
    }
  }

  /**
   * Check if any wallet is currently connected
   */
  public isConnected(): boolean {
    // Check if we have a current provider
    if (this.currentProvider) {
      const providerIsConnected = 'isConnected' in this.currentProvider &&
        typeof this.currentProvider.isConnected === 'function' ?
        this.currentProvider.isConnected() : false;
      return providerIsConnected;
    }

    // Fallback to checking stored connection
    const storedConnection = WalletStorage.loadConnection();
    return storedConnection?.connection?.isConnected ?? false;
  }

  /**
   * Get current connection details
   */
  public getConnection(): WalletConnection | null {
    // If we have a current provider, try to get connection from it first
    if (this.currentProvider) {
      const providerConnection = 'getConnection' in this.currentProvider &&
        typeof this.currentProvider.getConnection === 'function' ?
        this.currentProvider.getConnection() : null;
      const providerIsConnected = 'isConnected' in this.currentProvider &&
        typeof this.currentProvider.isConnected === 'function' ?
        this.currentProvider.isConnected() : false;

      console.log('WalletService: getConnection from provider', {
        hasProvider: !!this.currentProvider,
        providerConnection,
        providerId: this.currentProvider.id,
        providerIsConnected
      });
      if (providerConnection) {
        return providerConnection;
      }
    }

    // Fallback to stored connection if no current provider or provider doesn't have connection
    const storedConnection = WalletStorage.loadConnection();
    console.log('WalletService: getConnection from storage', {
      storedConnection,
      hasStoredConnection: !!storedConnection,
      connection: storedConnection?.connection,
      connectionIsConnected: storedConnection?.connection?.isConnected
    });
    return storedConnection?.connection || null;
  }

  /**
   * Attempt to restore previous connection
   */
  public async restoreConnection(): Promise<boolean> {
    try {
      // Check if storage is available
      if (!WalletStorage.isStorageAvailable()) {
        console.warn('Local storage not available, cannot restore connection');
        return false;
      }

      // Load stored connection data
      const storedConnection = WalletStorage.loadConnection();
      const preferences = WalletStorage.loadPreferences();

      if (!storedConnection || !preferences.autoConnect) {
        return false;
      }

      const { connection, providerId } = storedConnection;

      // Emit restoration starting event
      this.emit('connectionRestorationStarting', { providerId });

      // Check if the provider is still available
      const provider = this.getProvider(providerId);
      if (!provider) {
        console.warn(`Provider ${providerId} no longer available`);
        this.clearConnectionData();
        this.emit('connectionRestorationFailed', {
          providerId,
          reason: 'provider_not_found'
        });
        return false;
      }

      // For Kabila, try enhanced restoration first
      if (providerId === 'kabila') {
        const kabilaRestored = await this.restoreKabilaConnection(provider, connection);
        if (kabilaRestored) {
          this.emit('connectionRestorationCompleted', { providerId });
          return true;
        }
      }

      // Standard restoration flow
      const isAvailable = await this.checkProviderAvailabilityWithCache(provider);
      if (!isAvailable) {
        console.warn(`Provider ${providerId} is not available`);
        this.clearConnectionData();
        this.emit('connectionRestorationFailed', {
          providerId,
          reason: 'provider_not_available'
        });
        return false;
      }

      // Attempt to restore the connection
      const restoredConnection = await provider.connect();
      this.currentProvider = provider;

      // Verify and update connection data
      const isValidRestoration = await this.validateRestoredConnection(
        restoredConnection,
        connection,
        providerId
      );

      if (!isValidRestoration) {
        this.emit('connectionRestorationFailed', {
          providerId,
          reason: 'validation_failed'
        });
        return false;
      }

      // Set up provider-specific monitoring
      if (providerId === 'kabila') {
        this.setupKabilaConnectionSync(provider);
      }

      this.emit('connect', restoredConnection);
      this.emit('connectionRestorationCompleted', { providerId });
      return true;
    } catch (error) {
      console.warn('Failed to restore wallet connection:', error);
      this.clearConnectionData();
      const storedData = WalletStorage.loadConnection();
      this.emit('connectionRestorationFailed', {
        providerId: storedData?.providerId || 'unknown',
        reason: 'error',
        error
      });
      return false;
    }
  }

  /**
   * Enhanced Kabila connection restoration
   */
  private async restoreKabilaConnection(
    provider: WalletProvider,
    storedConnection: WalletConnection
  ): Promise<boolean> {
    try {
      // Check if Kabila adapter has its own restoration method
      if ('restoreConnection' in provider && typeof provider.restoreConnection === 'function') {
        const restoredConnection = await (provider as any).restoreConnection();

        if (restoredConnection) {
          this.currentProvider = provider;

          // Validate the restored connection
          const isValid = await this.validateRestoredConnection(
            restoredConnection,
            storedConnection,
            'kabila'
          );

          if (isValid) {
            this.setupKabilaConnectionSync(provider);
            this.emit('connect', restoredConnection);
            return true;
          }
        }
      }

      // Fallback to standard restoration if adapter doesn't have custom method
      try {
        const isAvailable = await this.checkProviderAvailabilityWithCache(provider);
        if (isAvailable) {
          const restoredConnection = await provider.connect();
          this.currentProvider = provider;

          const isValid = await this.validateRestoredConnection(
            restoredConnection,
            storedConnection,
            'kabila'
          );

          if (isValid) {
            this.setupKabilaConnectionSync(provider);
            this.emit('connect', restoredConnection);
            return true;
          }
        }
      } catch (fallbackError) {
        console.warn('Kabila fallback restoration failed:', fallbackError);
      }

      return false;
    } catch (error) {
      console.warn('Kabila-specific restoration failed:', error);
      return false;
    }
  }

  /**
   * Validate restored connection against stored data
   */
  private async validateRestoredConnection(
    restoredConnection: WalletConnection,
    storedConnection: WalletConnection,
    providerId: string
  ): Promise<boolean> {
    try {
      // Check if account ID matches
      if (restoredConnection.accountId !== storedConnection.accountId) {
        console.warn(
          `Restored connection account mismatch for ${providerId}:`,
          `stored: ${storedConnection.accountId}, restored: ${restoredConnection.accountId}`
        );

        // Update stored data with new account info
        WalletStorage.saveConnection(restoredConnection, providerId);

        // Get fresh account info
        const provider = this.getProvider(providerId);
        if (provider) {
          try {
            const accountInfo = await provider.getAccountInfo();
            WalletStorage.saveAccountInfo(accountInfo);
          } catch (error) {
            console.warn('Failed to update account info after restoration:', error);
          }
        }

        // Emit account change event
        this.emit('accountChanged', {
          accountId: restoredConnection.accountId,
          network: restoredConnection.network
        });
      }

      // Check network consistency
      if (restoredConnection.network !== storedConnection.network) {
        console.warn(
          `Network changed during restoration for ${providerId}:`,
          `stored: ${storedConnection.network}, restored: ${restoredConnection.network}`
        );

        // Update stored connection with new network
        WalletStorage.saveConnection(restoredConnection, providerId);

        // Emit network change event
        this.emit('networkChanged', {
          oldNetwork: storedConnection.network,
          newNetwork: restoredConnection.network
        });
      }

      // Validate network against expected network
      const networkValidation = this.networkValidator.validateNetwork(
        restoredConnection.network
      );

      if (!networkValidation.isValid) {
        console.warn(`Restored connection has invalid network: ${restoredConnection.network}`);
        this.emit('networkValidationFailed', {
          connection: restoredConnection,
          validation: networkValidation,
          providerId
        });

        // Don't fail restoration for network issues, just warn
      }

      return true;
    } catch (error) {
      console.warn('Connection validation failed during restoration:', error);
      return false;
    }
  }

  /**
   * Enhanced connection data storage with validation
   */
  private saveConnectionData(
    connection: WalletConnection,
    providerId: string
  ): void {
    if (!WalletStorage.isStorageAvailable()) {
      console.warn('Local storage not available, cannot save connection data');
      return;
    }

    try {
      // Validate connection data before saving
      if (!connection.accountId || !connection.network) {
        console.warn('Invalid connection data, skipping save:', connection);
        return;
      }

      // Save connection data with enhanced metadata
      const enhancedConnection = {
        ...connection,
        timestamp: Date.now(),
        version: '1.0.0' // For future compatibility
      };

      WalletStorage.saveConnection(enhancedConnection, providerId);

      // Save preferences with connection timestamp
      const preferences: WalletPreferences = {
        lastUsedProvider: providerId,
        autoConnect: true,
        connectionTimestamp: Date.now(),
      };
      WalletStorage.savePreferences(preferences);

      // Emit data saved event
      this.emit('connectionDataSaved', { providerId, connection: enhancedConnection });
    } catch (error) {
      console.warn('Failed to save connection data:', error);
    }
  }

  /**
   * Add event listener
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
  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(
            `Error in wallet service event listener for ${event}:`,
            error
          );
        }
      });
    }
  }

  /**
   * Create a standardized wallet error
   */
  private createError(
    type: WalletErrorType,
    message: string,
    details?: any
  ): WalletError {
    return {
      type,
      message,
      details,
    };
  }

  /**
   * Handle errors and convert to WalletError
   */
  private handleError(error: any): WalletError {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'message' in error
    ) {
      return error as WalletError;
    }

    if (error instanceof Error) {
      return this.createError(
        WalletErrorType.UNKNOWN_ERROR,
        error.message,
        error
      );
    }

    return this.createError(
      WalletErrorType.UNKNOWN_ERROR,
      'An unknown error occurred',
      error
    );
  }



  /**
   * Clear all connection data from local storage
   */
  private clearConnectionData(): void {
    WalletStorage.clearConnection();
    WalletStorage.clearAccountInfo();
  }

  /**
   * Get connection preferences from local storage
   */
  public getConnectionPreferences(): WalletPreferences {
    return WalletStorage.loadPreferences();
  }

  /**
   * Update connection preferences
   */
  public updatePreferences(updates: Partial<WalletPreferences>): void {
    const current = WalletStorage.loadPreferences();
    const updated = { ...current, ...updates };
    WalletStorage.savePreferences(updated);
  }

  /**
   * Refresh provider availability and emit events for changes
   */
  public async refreshProviderAvailability(): Promise<void> {
    const availabilityStatus = await this.getProviderAvailabilityStatus();
    const availableProviders = Array.from(availabilityStatus.entries())
      .filter(([_, isAvailable]) => isAvailable)
      .map(([providerId, _]) => providerId);

    this.emit('providersAvailabilityChanged', {
      availabilityStatus: Object.fromEntries(availabilityStatus),
      availableProviders,
    });
  }

  /**
   * Save account info to storage
   */
  public saveAccountInfo(accountInfo: AccountInfo): void {
    WalletStorage.saveAccountInfo(accountInfo);
  }

  /**
   * Load account info from storage
   */
  public loadAccountInfo(): AccountInfo | null {
    return WalletStorage.loadAccountInfo();
  }

  /**
   * Get the network validator instance
   */
  public getNetworkValidator(): NetworkValidator {
    return this.networkValidator;
  }

  /**
   * Validate the current network against expected network
   */
  public validateCurrentNetwork(): NetworkValidationResult | null {
    const connection = this.getConnection();
    if (!connection) {
      return null;
    }

    return this.networkValidator.validateNetwork(connection.network);
  }

  /**
   * Check if the current network is valid
   */
  public isCurrentNetworkValid(): boolean {
    const validation = this.validateCurrentNetwork();
    return validation ? validation.isValid : false;
  }

  /**
   * Request network switch for current provider
   */
  public async requestNetworkSwitch(targetNetwork: NetworkType): Promise<void> {
    if (!this.currentProvider) {
      throw createWalletError(
        WalletErrorType.UNKNOWN_ERROR,
        'No wallet connected'
      );
    }

    const switchRequest = this.networkValidator.createSwitchRequest(
      targetNetwork,
      this.currentProvider.id,
      false
    );

    // Validate the switch request
    const validation =
      this.networkValidator.validateSwitchRequest(switchRequest);
    if (!validation.isValid && validation.error) {
      throw validation.error;
    }

    // Emit network switch request event
    this.emit('networkSwitchRequested', switchRequest);

    // For now, we emit the request and let the UI handle the actual switching
    // In a real implementation, this might attempt to call provider-specific switch methods
    throw createWalletError(
      WalletErrorType.WRONG_NETWORK,
      `Please manually switch your ${this.currentProvider.name} wallet to ${this.networkValidator.getNetworkDisplayName(targetNetwork)} and reconnect.`
    );
  }

  /**
   * Handle network change from wallet provider
   */
  public async handleNetworkChange(newNetwork: NetworkType): Promise<void> {
    const connection = this.getConnection();
    if (!connection) {
      return;
    }

    // Update connection with new network
    const updatedConnection: WalletConnection = {
      ...connection,
      network: newNetwork,
    };

    // Validate the new network
    const validation = this.networkValidator.validateNetwork(newNetwork);

    // Update stored connection
    if (this.currentProvider) {
      WalletStorage.saveConnection(updatedConnection, this.currentProvider.id);
    }

    // Emit network change events
    this.emit('networkChanged', {
      oldNetwork: connection.network,
      newNetwork,
      validation,
    });

    // If network is invalid, emit network validation error
    if (!validation.isValid && validation.error) {
      this.emit('error', validation.error);
    }
  }

  /**
   * Set expected network for validation
   */
  public setExpectedNetwork(network: NetworkType): void {
    this.networkValidator.updateConfig({ expectedNetwork: network });
  }

  /**
   * Get expected network
   */
  public getExpectedNetwork(): NetworkType {
    return this.networkValidator.getConfig().expectedNetwork;
  }

  /**
   * Enable or disable automatic network switching
   */
  public setAutoSwitchEnabled(enabled: boolean): void {
    this.networkValidator.updateConfig({ allowAutoSwitch: enabled });
  }

  /**
   * Set up Kabila-specific connection synchronization
   */
  private setupKabilaConnectionSync(provider: WalletProvider): void {
    // Set up event listeners for Kabila-specific events
    if ('addEventListener' in provider && typeof provider.addEventListener === 'function') {
      // Listen for connection state changes
      provider.addEventListener('connectionStateChanged', (state: any) => {
        this.handleKabilaConnectionStateChange(state);
      });

      // Listen for health issues
      provider.addEventListener('healthIssue', (issue: any) => {
        this.emit('providerHealthIssue', {
          providerId: provider.id,
          issue
        });
      });

      // Listen for diagnostic updates
      provider.addEventListener('diagnosticsUpdated', (diagnostics: any) => {
        this.emit('providerDiagnosticsUpdated', {
          providerId: provider.id,
          diagnostics
        });
      });
    }

    // Start periodic connection validation for Kabila
    this.startKabilaConnectionValidation(provider);
  }

  /**
   * Handle Kabila connection state changes
   */
  private handleKabilaConnectionStateChange(state: any): void {
    if (!this.currentProvider || this.currentProvider.id !== 'kabila') {
      return;
    }

    // Sync connection state
    const currentConnection = this.getConnection();
    if (currentConnection) {
      // Update connection state based on provider state
      if (state.isConnected !== currentConnection.isConnected) {
        if (!state.isConnected) {
          // Provider disconnected, update our state
          this.currentProvider = null;
          this.clearConnectionData();
          this.emit('disconnect');
        }
      }

      // Update account info if changed
      if (state.accountId && state.accountId !== currentConnection.accountId) {
        const updatedConnection = {
          ...currentConnection,
          accountId: state.accountId,
          network: state.network || currentConnection.network
        };

        this.saveConnectionData(updatedConnection, 'kabila');
        this.emit('accountChanged', {
          accountId: state.accountId,
          network: updatedConnection.network
        });
      }
    }
  }

  /**
   * Start periodic connection validation for Kabila
   */
  private startKabilaConnectionValidation(provider: WalletProvider): void {
    // Clear any existing validation interval
    if ((this as any).kabilaValidationInterval) {
      clearInterval((this as any).kabilaValidationInterval);
    }

    // Start validation every 30 seconds
    (this as any).kabilaValidationInterval = setInterval(async () => {
      try {
        await this.validateKabilaConnectionState(provider);
      } catch (error) {
        console.warn('Kabila connection validation failed:', error);
      }
    }, 30000);
  }

  /**
   * Validate Kabila connection state and sync if needed
   */
  private async validateKabilaConnectionState(provider: WalletProvider): Promise<void> {
    if (!this.currentProvider || this.currentProvider.id !== 'kabila') {
      return;
    }

    try {
      // Use the adapter's sync method if available
      if ('syncConnectionState' in provider && typeof provider.syncConnectionState === 'function') {
        const isSynced = await (provider as any).syncConnectionState();

        // Update service state based on sync result
        if (!isSynced && this.currentProvider) {
          // Connection was lost during sync
          this.currentProvider = null;
          this.clearConnectionData();
          this.emit('disconnect');
        }

        return;
      }

      // Fallback to manual validation
      const isProviderConnected = 'isConnected' in provider &&
        typeof provider.isConnected === 'function' ?
        provider.isConnected() : false;
      const serviceConnection = this.getConnection();

      if (serviceConnection?.isConnected && !isProviderConnected) {
        // Service thinks it's connected but provider doesn't
        console.warn('Kabila connection state mismatch detected, disconnecting');
        await this.disconnect();
        return;
      }

      if (!serviceConnection?.isConnected && isProviderConnected) {
        // Provider is connected but service doesn't know
        console.warn('Kabila connected but service not aware, syncing state');
        try {
          const accountInfo = await provider.getAccountInfo();
          const connection: WalletConnection = {
            accountId: accountInfo.accountId,
            network: accountInfo.network,
            isConnected: true
          };

          this.saveConnectionData(connection, 'kabila');
          this.emit('connect', connection);
        } catch (error) {
          console.warn('Failed to sync Kabila connection state:', error);
        }
      }

      // Validate account consistency
      if (serviceConnection && isProviderConnected) {
        try {
          const currentAccountInfo = await provider.getAccountInfo();
          if (currentAccountInfo.accountId !== serviceConnection.accountId) {
            // Account changed, update stored connection
            const updatedConnection = {
              ...serviceConnection,
              accountId: currentAccountInfo.accountId,
              network: currentAccountInfo.network
            };

            this.saveConnectionData(updatedConnection, 'kabila');
            this.emit('accountChanged', currentAccountInfo);
          }
        } catch (error) {
          console.warn('Failed to validate Kabila account consistency:', error);
        }
      }

    } catch (error) {
      console.warn('Kabila connection validation error:', error);
    }
  }

  /**
   * Stop Kabila connection validation
   */
  private stopKabilaConnectionValidation(): void {
    if ((this as any).kabilaValidationInterval) {
      clearInterval((this as any).kabilaValidationInterval);
      (this as any).kabilaValidationInterval = null;
    }
  }

  /**
   * Check if automatic network switching is enabled
   */
  public isAutoSwitchEnabled(): boolean {
    return this.networkValidator.getConfig().allowAutoSwitch;
  }

  /**
   * Connect with retry mechanism
   */
  public async connectWithRetry(
    providerId: string,
    maxRetries: number = 3
  ): Promise<WalletConnection> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.connect(providerId);
      } catch (error) {
        lastError = error;

        // Don't retry for certain error types
        if (
          isWalletError(error) &&
          (error.type === WalletErrorType.CONNECTION_REJECTED ||
            error.type === WalletErrorType.PROVIDER_NOT_FOUND)
        ) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Connect with automatic network switching
   */
  public async connectWithAutoSwitch(
    providerId: string
  ): Promise<WalletConnection> {
    try {
      return await this.connect(providerId);
    } catch (error) {
      if (
        isWalletError(error) &&
        error.type === WalletErrorType.WRONG_NETWORK &&
        this.isAutoSwitchEnabled()
      ) {
        // Attempt auto-switch and retry
        try {
          // In a real implementation, this would attempt to switch networks
          // For now, we'll just retry the connection
          return await this.connect(providerId);
        } catch (switchError) {
          throw error; // Throw original error if switch fails
        }
      }
      throw error;
    }
  }

  /**
   * Force refresh of provider availability status
   * Useful for Kabila when extension state might have changed
   */
  public async forceRefreshProviderAvailability(providerId?: string): Promise<void> {
    if (providerId) {
      // Clear cache for specific provider
      this.clearAvailabilityCache(providerId);

      // For Kabila, also clear its internal cache
      const provider = this.getProvider(providerId);
      if (provider && providerId === 'kabila' && 'clearAvailabilityCache' in provider) {
        (provider as any).clearAvailabilityCache();
      }
    } else {
      // Clear all caches
      this.clearAvailabilityCache();

      // Clear Kabila's internal cache if it exists
      const kabilaProvider = this.getProvider('kabila');
      if (kabilaProvider && 'clearAvailabilityCache' in kabilaProvider) {
        (kabilaProvider as any).clearAvailabilityCache();
      }
    }

    // Emit refresh event
    this.emit('providerAvailabilityRefreshed', { providerId });
  }

  /**
   * Get detailed provider status including diagnostics for Kabila
   */
  public async getDetailedProviderStatus(providerId: string): Promise<{
    isRegistered: boolean;
    isAvailable: boolean;
    isConnected: boolean;
    diagnostics?: any;
    lastError?: string;
  }> {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return {
        isRegistered: false,
        isAvailable: false,
        isConnected: false
      };
    }

    try {
      const isAvailable = await this.checkProviderAvailabilityWithCache(provider);
      const isConnected = this.currentProvider?.id === providerId && this.isConnected();

      const status = {
        isRegistered: true,
        isAvailable,
        isConnected
      };

      // Get Kabila-specific diagnostics if available
      if (providerId === 'kabila' && 'getDiagnostics' in provider) {
        try {
          const diagnostics = (provider as any).getDiagnostics();
          return {
            ...status,
            diagnostics
          };
        } catch (error) {
          return {
            ...status,
            lastError: error instanceof Error ? error.message : 'Failed to get diagnostics'
          };
        }
      }

      return status;
    } catch (error) {
      return {
        isRegistered: true,
        isAvailable: false,
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the last error that occurred
   */
  public getLastError(): WalletError | null {
    // In a real implementation, this would track the last error
    // For now, return null as errors are handled via events
    return null;
  }
}

// Create and export singleton instance
const createWalletService = () => {
  return new WalletService();
};

export const walletService = createWalletService();
