import { WalletService } from './WalletService';
import { WalletError, WalletErrorType } from '../../types/wallet';
import { createWalletError } from '../../utils/walletErrorHandling';

/**
 * Validation result interface with detailed error information
 */
export interface ValidationResult {
    isValid: boolean;
    blockers: string[];
    warnings: string[];
    error?: WalletError;
    details: {
        walletServiceInitialized: boolean;
        hasActiveConnection: boolean;
        providersAvailable: boolean;
        hasBlockingErrors: boolean;
        reduxStateConsistent: boolean;
    };
}

/**
 * Connection validation rules and state checks
 */
export interface ValidationRules {
    requireWalletServiceInitialized: boolean;
    requireNoActiveConnection: boolean;
    requireProvidersAvailable: boolean;
    requireNoBlockingErrors: boolean;
    requireReduxStateConsistency: boolean;
}

/**
 * Default validation rules for wallet connections
 */
export const DEFAULT_VALIDATION_RULES: ValidationRules = {
    requireWalletServiceInitialized: true,
    requireNoActiveConnection: false, // Allow connections when already connected (for switching)
    requireProvidersAvailable: true,
    requireNoBlockingErrors: true,
    requireReduxStateConsistency: true,
};

/**
 * ConnectionValidator class that validates wallet connection state
 * and provides detailed information about connection blockers
 */
export class ConnectionValidator {
    private walletService: WalletService;
    private validationRules: ValidationRules;

    constructor(
        walletService: WalletService,
        rules: Partial<ValidationRules> = {}
    ) {
        this.walletService = walletService;
        this.validationRules = { ...DEFAULT_VALIDATION_RULES, ...rules };
    }

    /**
     * Check if wallet connections are currently allowed
     */
    public canConnect(): boolean {
        const result = this.validateConnectionState();
        return result.isValid;
    }

    /**
     * Get list of current connection blockers
     */
    public getConnectionBlockers(): string[] {
        const result = this.validateConnectionState();
        return result.blockers;
    }

    /**
     * Perform comprehensive connection state validation
     */
    public validateConnectionState(): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            blockers: [],
            warnings: [],
            details: {
                walletServiceInitialized: false,
                hasActiveConnection: false,
                providersAvailable: false,
                hasBlockingErrors: false,
                reduxStateConsistent: false,
            },
        };

        // Check wallet service initialization
        const serviceInitialized = this.checkWalletServiceInitialized();
        result.details.walletServiceInitialized = serviceInitialized;

        if (this.validationRules.requireWalletServiceInitialized && !serviceInitialized) {
            result.isValid = false;

            // Get detailed service status for better error message
            const providerCount = this.walletService.getProviderCount();

            if (providerCount === 0) {
                result.blockers.push('No wallet providers available');
                console.error('❌ Wallet service validation failed: No providers registered');
            } else {
                result.blockers.push('Wallet service not initialized');
                console.error('❌ Wallet service validation failed: Service not marked as initialized');
            }
        }

        // Check for active connections
        const hasActiveConnection = this.checkActiveConnection();
        result.details.hasActiveConnection = hasActiveConnection;

        if (this.validationRules.requireNoActiveConnection && hasActiveConnection) {
            result.isValid = false;
            result.blockers.push('Another wallet connection is already active');
        }

        // Check provider availability
        const providersAvailable = this.checkProvidersAvailable();
        result.details.providersAvailable = providersAvailable;

        if (this.validationRules.requireProvidersAvailable && !providersAvailable) {
            result.isValid = false;
            const providerCount = this.walletService.getProviderCount();

            if (providerCount === 0) {
                result.blockers.push('No wallet providers available - providers may not be registered yet');
                console.error('❌ No wallet providers available. Provider count:', providerCount);
            } else {
                result.blockers.push('Wallet providers are not available');
                console.error('❌ Wallet providers not available despite being registered. Count:', providerCount);
            }
        }

        // Check for blocking errors
        const hasBlockingErrors = this.checkBlockingErrors();
        result.details.hasBlockingErrors = hasBlockingErrors;

        if (this.validationRules.requireNoBlockingErrors && hasBlockingErrors) {
            result.isValid = false;
            result.blockers.push('Blocking wallet errors are present');
        }

        // Check Redux state consistency
        const reduxStateConsistent = this.checkReduxStateConsistency();
        result.details.reduxStateConsistent = reduxStateConsistent;

        if (this.validationRules.requireReduxStateConsistency && !reduxStateConsistent) {
            result.isValid = false;
            result.blockers.push('Redux state is inconsistent');
        }

        // Add warnings for non-critical issues
        this.addValidationWarnings(result);

        // Create error if validation failed
        if (!result.isValid) {
            result.error = createWalletError(
                WalletErrorType.UNKNOWN_ERROR,
                `Cannot connect wallet: ${result.blockers.join(', ')}`,
                { blockers: result.blockers, details: result.details }
            );
        }

        return result;
    }

    /**
     * Initialize wallet service if needed
     */
    public async initializeIfNeeded(): Promise<void> {
        if (!this.checkWalletServiceInitialized()) {
            try {
                // Refresh provider availability to initialize service
                this.walletService.refreshProviderAvailability();

                // Wait a short time for initialization
                await new Promise(resolve => setTimeout(resolve, 100));

                if (!this.checkWalletServiceInitialized()) {
                    throw createWalletError(
                        WalletErrorType.UNKNOWN_ERROR,
                        'Failed to initialize wallet service'
                    );
                }
            } catch (error) {
                throw createWalletError(
                    WalletErrorType.UNKNOWN_ERROR,
                    'Wallet service initialization failed',
                    error
                );
            }
        }
    }

    /**
     * Update validation rules
     */
    public updateRules(rules: Partial<ValidationRules>): void {
        this.validationRules = { ...this.validationRules, ...rules };
    }

    /**
     * Get current validation rules
     */
    public getRules(): ValidationRules {
        return { ...this.validationRules };
    }

    /**
     * Check if wallet service is properly initialized
     */
    private checkWalletServiceInitialized(): boolean {
        try {
            // Check if service is marked as initialized
            const initStatus = this.walletService.getInitializationStatus();

            // Check if service has providers registered
            const providerCount = this.walletService.getProviderCount();

            // Check if service can provide basic functionality
            const providers = this.walletService.getProviders();

            const isInitialized = initStatus.isInitialized && providerCount > 0 && Array.isArray(providers);

            if (!isInitialized) {
                console.warn('Wallet service initialization check failed:', {
                    isMarkedInitialized: initStatus.isInitialized,
                    providerCount,
                    hasProviders: Array.isArray(providers),
                    providers: initStatus.providers,
                });
            }

            return isInitialized;
        } catch (error) {
            console.warn('Error checking wallet service initialization:', error);
            return false;
        }
    }

    /**
     * Check for active wallet connections
     */
    private checkActiveConnection(): boolean {
        try {
            return this.walletService.isConnected();
        } catch (error) {
            console.warn('Error checking active connection:', error);
            return false;
        }
    }

    /**
     * Check if wallet providers are available
     */
    private checkProvidersAvailable(): boolean {
        try {
            const providers = this.walletService.getAvailableProviders();
            return providers.length > 0;
        } catch (error) {
            console.warn('Error checking provider availability:', error);
            return false;
        }
    }

    /**
     * Check for blocking wallet errors
     */
    private checkBlockingErrors(): boolean {
        try {
            const lastError = this.walletService.getLastError();

            if (!lastError) {
                return false;
            }

            // Define blocking error types
            const blockingErrorTypes = [
                WalletErrorType.PROVIDER_NOT_FOUND,
                WalletErrorType.CONNECTION_REJECTED,
                WalletErrorType.WALLET_LOCKED,
            ];

            return blockingErrorTypes.includes(lastError.type);
        } catch (error) {
            console.warn('Error checking blocking errors:', error);
            return false;
        }
    }

    /**
     * Check Redux state consistency
     */
    private checkReduxStateConsistency(): boolean {
        try {
            // Check if service connection state matches what we expect
            const serviceConnection = this.walletService.getConnection();
            const serviceIsConnected = this.walletService.isConnected();

            // Basic consistency check
            if (serviceConnection && serviceConnection.isConnected !== serviceIsConnected) {
                return false;
            }

            // Check if current provider is consistent
            const currentProvider = this.walletService.getCurrentProvider();
            if (serviceIsConnected && !currentProvider) {
                return false;
            }

            if (!serviceIsConnected && currentProvider) {
                return false;
            }

            return true;
        } catch (error) {
            console.warn('Error checking Redux state consistency:', error);
            return false;
        }
    }

    /**
     * Add validation warnings for non-critical issues
     */
    private addValidationWarnings(result: ValidationResult): void {
        try {
            // Check for network validation issues
            const networkValidation = this.walletService.validateCurrentNetwork();
            if (networkValidation && !networkValidation.isValid) {
                result.warnings.push('Current network may not be supported');
            }

            // Check for provider-specific warnings
            const providers = this.walletService.getAvailableProviders();
            if (providers.length === 1) {
                result.warnings.push('Only one wallet provider is available');
            }

            // Check for auto-connect preferences
            const preferences = this.walletService.getConnectionPreferences();
            if (!preferences.autoConnect) {
                result.warnings.push('Auto-connect is disabled');
            }

        } catch (error) {
            console.warn('Error adding validation warnings:', error);
        }
    }

    /**
     * Validate specific provider availability
     */
    public validateProviderAvailability(providerId: string): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            blockers: [],
            warnings: [],
            details: {
                walletServiceInitialized: this.checkWalletServiceInitialized(),
                hasActiveConnection: this.checkActiveConnection(),
                providersAvailable: false,
                hasBlockingErrors: this.checkBlockingErrors(),
                reduxStateConsistent: this.checkReduxStateConsistency(),
            },
        };

        // Check if specific provider is available
        const isProviderAvailable = this.walletService.isProviderAvailable(providerId);
        result.details.providersAvailable = isProviderAvailable;

        if (!isProviderAvailable) {
            result.isValid = false;
            result.blockers.push(`Provider ${providerId} is not available`);
        }

        // Check provider-specific status
        const providerStatus = this.walletService.getDetailedProviderStatus(providerId);

        if (!providerStatus.isRegistered) {
            result.isValid = false;
            result.blockers.push(`Provider ${providerId} is not registered`);
        }

        if (providerStatus.isRegistered && !providerStatus.isAvailable) {
            result.isValid = false;
            result.blockers.push(`Provider ${providerId} is not available (may not be installed)`);
        }

        // Create error if validation failed
        if (!result.isValid) {
            result.error = createWalletError(
                WalletErrorType.PROVIDER_NOT_FOUND,
                `Provider ${providerId} validation failed: ${result.blockers.join(', ')}`,
                { providerId, blockers: result.blockers, details: result.details }
            );
        }

        return result;
    }

    /**
     * Get validation summary for debugging
     */
    public getValidationSummary(): {
        canConnect: boolean;
        blockers: string[];
        warnings: string[];
        serviceStatus: {
            initialized: boolean;
            providerCount: number;
            isConnected: boolean;
            currentProvider: string | null;
        };
    } {
        const validation = this.validateConnectionState();

        return {
            canConnect: validation.isValid,
            blockers: validation.blockers,
            warnings: validation.warnings,
            serviceStatus: {
                initialized: validation.details?.walletServiceInitialized || false,
                providerCount: this.walletService.getProviderCount(),
                isConnected: this.walletService.isConnected(),
                currentProvider: this.walletService.getCurrentProvider()?.id || null,
            },
        };
    }
}