import {
    EnhancedCreateSwapRequest,
    WalletBalanceRequirement,
    WalletBalanceValidation,
    WalletConnectionValidation,
    SwapWalletValidation,
    BalanceCalculator
} from '@booking-swap/shared';
import { walletService } from '../walletService';
import { WalletConnectionValidator, DetailedConnectionValidation, ValidationCheck } from './WalletConnectionValidator';

/**
 * Swap type enumeration for validation
 */
export enum SwapType {
    BOOKING_EXCHANGE = 'booking_exchange',
    CASH_ENABLED = 'cash_enabled'
}

/**
 * Swap type specific validation result
 */
export interface SwapTypeValidationResult extends SwapWalletValidation {
    swapType: SwapType;
    typeSpecificErrors: string[];
}

/**
 * Service for validating wallet connection and balance requirements for swap creation
 */
export class WalletValidationService {
    private balanceCalculator: BalanceCalculator;
    private connectionValidator: WalletConnectionValidator;

    constructor() {
        this.balanceCalculator = new BalanceCalculator();
        this.connectionValidator = new WalletConnectionValidator();
    }
    /**
     * Validates wallet connection and balance for swap creation with swap type specific logic
     */
    async validateSwapCreation(swapData: EnhancedCreateSwapRequest): Promise<SwapTypeValidationResult> {
        const connectionValidation = await this.validateWalletConnection();

        if (!connectionValidation.isConnected) {
            return {
                connection: connectionValidation,
                isValid: false,
                errors: [connectionValidation.errorMessage || 'Wallet not connected'],
                swapType: this.determineSwapType(swapData),
                typeSpecificErrors: [],
            };
        }

        // Determine swap type and perform type-specific validation
        const swapType = this.determineSwapType(swapData);
        const typeSpecificValidation = await this.validateSwapTypeSpecific(swapData, swapType);

        return {
            connection: connectionValidation,
            balance: typeSpecificValidation.balance,
            isValid: connectionValidation.isConnected && typeSpecificValidation.isValid,
            errors: [
                ...(connectionValidation.errorMessage ? [connectionValidation.errorMessage] : []),
                ...typeSpecificValidation.errors,
            ],
            swapType,
            typeSpecificErrors: typeSpecificValidation.typeSpecificErrors,
        };
    }

    /**
     * Determines the swap type based on payment configuration
     */
    determineSwapType(swapData: EnhancedCreateSwapRequest): SwapType {
        const { paymentTypes } = swapData;

        // If cash payment is enabled and has a minimum amount, it's cash-enabled
        if (paymentTypes.cashPayment && (paymentTypes.minimumCashAmount || 0) > 0) {
            return SwapType.CASH_ENABLED;
        }

        // Otherwise, it's a booking exchange only
        return SwapType.BOOKING_EXCHANGE;
    }

    /**
     * Performs swap type specific validation
     */
    async validateSwapTypeSpecific(swapData: EnhancedCreateSwapRequest, swapType: SwapType): Promise<{
        balance?: WalletBalanceValidation;
        isValid: boolean;
        errors: string[];
        typeSpecificErrors: string[];
    }> {
        const typeSpecificErrors: string[] = [];

        // Calculate balance requirements based on swap type
        const requirements = this.calculateBalanceRequirements(swapData);

        // Validate balance
        const balanceValidation = await this.validateWalletBalance(requirements);

        // Add swap type specific validation logic
        if (swapType === SwapType.CASH_ENABLED) {
            const cashValidationErrors = this.validateCashEnabledSwap(swapData);
            typeSpecificErrors.push(...cashValidationErrors);
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            const bookingValidationErrors = this.validateBookingExchangeSwap(swapData);
            typeSpecificErrors.push(...bookingValidationErrors);
        }

        const allErrors = [
            ...(balanceValidation.errorMessage ? [balanceValidation.errorMessage] : []),
            ...typeSpecificErrors,
        ];

        return {
            balance: balanceValidation,
            isValid: balanceValidation.isSufficient && typeSpecificErrors.length === 0,
            errors: allErrors,
            typeSpecificErrors,
        };
    }

    /**
     * Validates cash-enabled swap specific requirements
     */
    private validateCashEnabledSwap(swapData: EnhancedCreateSwapRequest): string[] {
        const { paymentTypes } = swapData;
        return this.getSwapTypeValidationErrors(SwapType.CASH_ENABLED, paymentTypes);
    }

    /**
     * Validates booking exchange swap specific requirements
     */
    private validateBookingExchangeSwap(swapData: EnhancedCreateSwapRequest): string[] {
        const { paymentTypes } = swapData;
        return this.getSwapTypeValidationErrors(SwapType.BOOKING_EXCHANGE, paymentTypes);
    }

    /**
     * Get standardized validation errors for swap types
     */
    private getSwapTypeValidationErrors(
        swapType: SwapType,
        paymentTypes: {
            bookingExchange: boolean;
            cashPayment: boolean;
            minimumCashAmount?: number;
        }
    ): string[] {
        const errors: string[] = [];

        if (swapType === SwapType.CASH_ENABLED) {
            // Validate minimum cash amount
            if (!paymentTypes.minimumCashAmount || paymentTypes.minimumCashAmount <= 0) {
                errors.push('Cash-enabled swaps must specify a minimum cash amount greater than 0');
            }

            // Validate cash amount is reasonable (not too small for escrow fees)
            if (paymentTypes.minimumCashAmount && paymentTypes.minimumCashAmount < 1) {
                errors.push('Minimum cash amount should be at least 1 HBAR to cover platform fees');
            }
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            // Ensure booking exchange is enabled for booking-only swaps
            if (!paymentTypes.bookingExchange) {
                errors.push('Booking exchange must be enabled for booking-only swaps');
            }

            // Warn if cash payment is enabled but no minimum amount is set
            if (paymentTypes.cashPayment && !paymentTypes.minimumCashAmount) {
                errors.push('Cash payment is enabled but no minimum amount is specified. This will be treated as a booking-only swap.');
            }
        }

        return errors;
    }

    /**
     * Validates wallet connection status using enhanced validation with fallback
     */
    async validateWalletConnection(options?: {
        maxRetries?: number;
        retryDelay?: number;
        timeout?: number;
    }): Promise<WalletConnectionValidation> {
        const {
            maxRetries = 3,
            timeout = 10000 // 10 seconds
        } = options || {};

        let retryDelay = options?.retryDelay || 1000; // 1 second

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`WalletValidationService: Validation attempt ${attempt}/${maxRetries}`);

                // Use enhanced validation with timeout
                const detailedValidation = await this.validateConnectionWithTimeout(timeout);

                // Comprehensive logging for debugging connection validation issues
                console.log('WalletValidationService: Enhanced validation result', {
                    attempt,
                    isValid: detailedValidation.isValid,
                    primaryError: detailedValidation.primaryError,
                    checksCount: detailedValidation.checks.length,
                    failedChecks: detailedValidation.checks.filter(c => !c.passed).map(c => c.name),
                    diagnostics: {
                        timestamp: detailedValidation.diagnostics.timestamp,
                        walletServiceConnected: detailedValidation.diagnostics.walletServiceConnected,
                        connectionObjectExists: detailedValidation.diagnostics.connectionObjectExists,
                        accountId: detailedValidation.diagnostics.accountId,
                        connectionType: detailedValidation.diagnostics.connectionType,
                        stabilityScore: detailedValidation.diagnostics.stabilityAnalysis.stabilityScore
                    }
                });

                if (detailedValidation.isValid) {
                    console.log(`WalletValidationService: Enhanced validation passed on attempt ${attempt}`);
                    return {
                        isConnected: true,
                        walletAddress: detailedValidation.diagnostics.accountId || 'unknown',
                        canRetry: false
                    };
                }

                // Check if this is a retryable error
                const isRetryable = this.isRetryableError(detailedValidation);

                if (!isRetryable || attempt === maxRetries) {
                    // Non-retryable error or final attempt - return formatted error
                    const errorMessage = this.formatConnectionError(detailedValidation);

                    console.log('WalletValidationService: Enhanced validation failed (non-retryable or final attempt)', {
                        attempt,
                        isRetryable,
                        primaryError: detailedValidation.primaryError,
                        recommendationsCount: detailedValidation.recommendations.length
                    });

                    return {
                        isConnected: false,
                        errorMessage,
                        diagnostics: detailedValidation.diagnostics,
                        recommendations: detailedValidation.recommendations,
                        canRetry: isRetryable && attempt < maxRetries
                    };
                }

                // Retryable error - wait before next attempt
                console.log(`WalletValidationService: Retryable error on attempt ${attempt}, waiting ${retryDelay}ms before retry`, {
                    primaryError: detailedValidation.primaryError,
                    stabilityScore: detailedValidation.diagnostics.stabilityAnalysis.stabilityScore
                });

                if (attempt < maxRetries) {
                    await this.delay(retryDelay);
                    // Increase delay for subsequent retries (exponential backoff)
                    retryDelay = Math.min(retryDelay * 1.5, 5000);
                }

            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown validation error');
                console.warn(`WalletValidationService: Validation attempt ${attempt} threw error`, {
                    error: lastError.message,
                    willRetry: attempt < maxRetries
                });

                if (attempt === maxRetries) {
                    // Final attempt failed - fall back to legacy validation
                    console.warn('WalletValidationService: All enhanced validation attempts failed, falling back to legacy validation');
                    return this.fallbackValidateWalletConnection();
                }

                if (attempt < maxRetries) {
                    await this.delay(retryDelay);
                    retryDelay = Math.min(retryDelay * 1.5, 5000);
                }
            }
        }

        // This should not be reached, but handle it gracefully
        console.error('WalletValidationService: Unexpected end of retry loop');
        return this.fallbackValidateWalletConnection();
    }

    /**
     * Validates connection with timeout handling
     */
    private async validateConnectionWithTimeout(timeoutMs: number): Promise<DetailedConnectionValidation> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Validation timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            this.connectionValidator.validateConnection()
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * Determines if a validation error is retryable
     */
    private isRetryableError(validation: DetailedConnectionValidation): boolean {
        const { checks, diagnostics } = validation;

        // Check for stability issues (retryable)
        const stabilityCheck = checks.find(check => check.name === 'Connection Stability');
        if (stabilityCheck && !stabilityCheck.passed) {
            return true;
        }

        // Check for low stability score (retryable)
        if (diagnostics.stabilityAnalysis.stabilityScore < 50) {
            return true;
        }

        // Check for recent state changes (retryable)
        if (diagnostics.stabilityAnalysis.recentChanges > 0) {
            return true;
        }

        // Check for temporary connection issues
        const connectionCheck = checks.find(check => check.name === 'Connection Object');
        if (connectionCheck && !connectionCheck.passed &&
            connectionCheck.details.includes('temporary')) {
            return true;
        }

        // Service state errors are generally not retryable unless it's a temporary issue
        const serviceCheck = checks.find(check => check.name === 'Wallet Service State');
        if (serviceCheck && !serviceCheck.passed) {
            // Only retry if it seems like a temporary service issue
            return serviceCheck.details.includes('temporary') ||
                serviceCheck.details.includes('timeout');
        }

        // Account ID errors are generally not retryable
        const accountCheck = checks.find(check => check.name === 'Account ID');
        if (accountCheck && !accountCheck.passed) {
            return false;
        }

        // Default to not retryable for unknown errors
        return false;
    }

    /**
     * Utility method for delays in retry logic
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fallback validation logic for backward compatibility with Kabila-specific handling
     */
    private fallbackValidateWalletConnection(): WalletConnectionValidation {
        const connection = walletService.getConnection();

        // Debug logging to understand what's happening
        console.log('WalletValidationService: Fallback validation', {
            connection,
            hasConnection: !!connection,
            isConnected: connection?.isConnected,
            accountId: connection?.account?.accountId || (connection as any)?.accountId,
            connectionType: typeof connection,
            walletServiceIsConnected: walletService.isConnected()
        });

        // Handle different connection object structures
        if (!connection) {
            console.log('WalletValidationService: Fallback validation failed - no connection object');
            return {
                isConnected: false,
                errorMessage: 'Please connect your wallet before creating a swap',
            };
        }

        // Check connection status
        if (!connection.isConnected) {
            console.log('WalletValidationService: Fallback validation failed - connection not active');
            return {
                isConnected: false,
                errorMessage: 'Wallet connection is not active. Please reconnect your wallet.',
            };
        }

        // Handle different account ID structures (legacy vs new format)
        let accountId: string | undefined;

        // Try new format first (direct accountId property) - for different wallet types
        if ((connection as any).accountId) {
            accountId = (connection as any).accountId;
        }
        // Fall back to legacy format (nested account object)
        else if (connection.account?.accountId) {
            accountId = connection.account.accountId;
        }

        // Validate account ID format for Kabila wallet
        if (!accountId) {
            console.log('WalletValidationService: Fallback validation failed - no account ID found');
            return {
                isConnected: false,
                errorMessage: 'Wallet account information is missing. Please reconnect your wallet.',
            };
        }

        // Validate Kabila account ID format (Hedera format: 0.0.xxxxx)
        if (!this.isValidKabilaAccountId(accountId)) {
            console.log('WalletValidationService: Fallback validation failed - invalid account ID format', {
                accountId,
                format: 'Expected Hedera format: 0.0.xxxxx'
            });
            return {
                isConnected: false,
                errorMessage: 'Wallet account ID format is invalid. Please ensure you are connected to a valid Hedera account.',
            };
        }

        console.log('WalletValidationService: Fallback validation passed', {
            accountId,
            connectionType: connection.constructor?.name || 'unknown'
        });

        return {
            isConnected: true,
            walletAddress: accountId,
        };
    }

    /**
     * Validates Kabila wallet account ID format
     */
    private isValidKabilaAccountId(accountId: string): boolean {
        if (!accountId || typeof accountId !== 'string') {
            return false;
        }

        // Hedera account ID format: 0.0.xxxxx (where xxxxx is a number)
        const hederaAccountPattern = /^0\.0\.\d+$/;

        // Also accept mock account IDs for development/testing
        const mockAccountPattern = /^\d+$/; // Simple numeric IDs for mocks

        return hederaAccountPattern.test(accountId) ||
            (!import.meta.env.PROD && mockAccountPattern.test(accountId));
    }

    /**
     * Validates wallet balance against requirements
     */
    async validateWalletBalance(requirements: WalletBalanceRequirement): Promise<WalletBalanceValidation> {
        try {
            // Get current balance from wallet service
            const connection = walletService.getConnection();
            if (!connection.isConnected || !connection.account) {
                throw new Error('Wallet not connected');
            }

            // For now, parse the balance string from the wallet service
            // In a real implementation, this would query the blockchain directly
            const balanceString = connection.balance || '0 HBAR';
            const currentBalance = parseFloat(balanceString.replace(/[^\d.]/g, '')) || 0;

            const isSufficient = currentBalance >= requirements.totalRequired;
            const shortfall = isSufficient ? undefined : requirements.totalRequired - currentBalance;

            if (!isSufficient) {
                const errorMessage = this.formatBalanceError(currentBalance, requirements, shortfall!);
                return {
                    isSufficient: false,
                    currentBalance,
                    requirement: requirements,
                    shortfall,
                    errorMessage,
                };
            }

            return {
                isSufficient: true,
                currentBalance,
                requirement: requirements,
            };
        } catch (error) {
            return {
                isSufficient: false,
                currentBalance: 0,
                requirement: requirements,
                errorMessage: 'Unable to verify wallet balance. Please ensure your wallet is connected and try again.',
            };
        }
    }

    /**
     * Calculates balance requirements for a swap using the BalanceCalculator
     */
    calculateBalanceRequirements(swapData: EnhancedCreateSwapRequest): WalletBalanceRequirement {
        return this.balanceCalculator.calculateSwapRequirements(swapData);
    }

    /**
     * Formats a user-friendly balance error message with swap type context
     */
    private formatBalanceError(
        currentBalance: number,
        requirements: WalletBalanceRequirement,
        shortfall: number,
        swapType?: SwapType
    ): string {
        let message = `⚠️ Insufficient Wallet Balance\n\n`;

        // Add swap type specific context
        if (swapType === SwapType.CASH_ENABLED) {
            message += `Your wallet does not have enough funds to create this cash-enabled swap.\n\n`;
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            message += `Your wallet does not have enough funds to create this booking exchange swap.\n\n`;
        } else {
            message += `Your wallet does not have enough funds to create this swap.\n\n`;
        }

        message += `Current Balance: ${currentBalance.toFixed(2)} ${requirements.currency}\n`;
        message += `Required Amount: ${requirements.totalRequired.toFixed(2)} ${requirements.currency}\n`;
        message += `  - Transaction Fee: ${requirements.transactionFee.toFixed(2)} ${requirements.currency}\n`;

        if (requirements.escrowAmount > 0) {
            message += `  - Escrow Amount: ${requirements.escrowAmount.toFixed(2)} ${requirements.currency}\n`;
            message += `  - Platform Fee: ${requirements.platformFee.toFixed(2)} ${requirements.currency}\n`;
        }

        message += `\nShortfall: ${shortfall.toFixed(2)} ${requirements.currency}\n\n`;

        // Add swap type specific guidance
        if (swapType === SwapType.CASH_ENABLED) {
            message += `For cash-enabled swaps, you need funds for escrow and platform fees in addition to transaction costs.\n`;
            message += `Please add funds to your wallet before creating this swap.`;
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            message += `For booking exchange swaps, you only need to cover transaction fees.\n`;
            message += `Please add funds to your wallet before creating this swap.`;
        } else {
            message += `Please add funds to your wallet before creating this swap.`;
        }

        return message;
    }

    /**
     * Formats detailed connection error with diagnostic information and Kabila-specific recommendations
     */
    private formatConnectionError(detailedValidation: DetailedConnectionValidation): string {
        const { primaryError, diagnostics, recommendations, checks } = detailedValidation;

        // Categorize the error type
        const errorCategory = this.categorizeConnectionError(checks);

        let message = '';

        // Add category-specific header with Kabila-specific messaging
        switch (errorCategory) {
            case 'KABILA_NOT_INSTALLED':
                message = '🔌 Kabila Wallet Extension Not Found\n\n';
                message += 'The Kabila wallet extension is not installed or not detected in your browser.\n\n';
                break;
            case 'KABILA_LOCKED':
                message = '🔒 Kabila Wallet is Locked\n\n';
                message += 'Your Kabila wallet extension is installed but currently locked.\n\n';
                break;
            case 'KABILA_DISCONNECTED':
                message = '🔗 Kabila Wallet Not Connected\n\n';
                message += 'The Kabila wallet extension is available but not connected to this application.\n\n';
                break;
            case 'KABILA_EXTENSION_ERROR':
                message = '⚠️ Kabila Wallet Extension Issue\n\n';
                message += 'There is an issue with the Kabila wallet extension state.\n\n';
                break;
            case 'KABILA_CONSISTENCY_ERROR':
                message = '🔄 Kabila Connection State Mismatch\n\n';
                message += 'The connection state between the app and Kabila extension is inconsistent.\n\n';
                break;
            case 'SERVICE_ERROR':
                message = '🔗 Wallet Service Connection Issue\n\n';
                message += 'The wallet service is not reporting a proper connection state.\n\n';
                break;
            case 'CONNECTION_ERROR':
                message = '⚠️ Wallet Connection Data Issue\n\n';
                message += 'Your wallet appears connected but connection information is incomplete.\n\n';
                break;
            case 'ACCOUNT_ERROR':
                message = '👤 Wallet Account Information Issue\n\n';
                message += 'Wallet connection exists but account information is missing or invalid.\n\n';
                break;
            case 'STABILITY_ERROR':
                message = '⏱️ Connection Stability Issue\n\n';
                message += 'Your wallet connection is unstable and may need time to stabilize.\n\n';
                break;
            default:
                message = '❌ Wallet Connection Failed\n\n';
                message += 'There was an issue validating your wallet connection.\n\n';
        }

        // Add primary error
        if (primaryError) {
            message += `Primary Issue: ${primaryError}\n\n`;
        }

        // Add diagnostic details with Kabila-specific information
        message += 'Diagnostic Details:\n';
        message += `- Service Connected: ${diagnostics.walletServiceConnected}\n`;
        message += `- Connection Object: ${diagnostics.connectionObjectExists ? 'exists' : 'missing'}\n`;
        message += `- Account ID: ${diagnostics.accountId || 'missing'}\n`;
        message += `- Connection Type: ${diagnostics.connectionType}\n`;

        // Add Kabila-specific diagnostics if available
        if (this.isKabilaError(errorCategory)) {
            message += this.getKabilaDiagnosticInfo();
        }

        if (diagnostics.stabilityAnalysis) {
            message += `- Stability Score: ${diagnostics.stabilityAnalysis.stabilityScore}/100\n`;
            if (diagnostics.stabilityAnalysis.recentChanges > 0) {
                message += `- Recent Changes: ${diagnostics.stabilityAnalysis.recentChanges}\n`;
            }
        }

        if (diagnostics.lastStateChange) {
            const timeSince = Date.now() - diagnostics.lastStateChange.getTime();
            message += `- Last State Change: ${Math.round(timeSince / 1000)} seconds ago\n`;
        }

        // Add failed checks details
        const failedChecks = checks.filter(check => !check.passed);
        if (failedChecks.length > 0) {
            message += '\nFailed Validation Checks:\n';
            failedChecks.forEach((check, index) => {
                message += `${index + 1}. ${check.name}: ${check.details}\n`;
            });
        }

        // Add actionable recommendations
        if (recommendations.length > 0) {
            message += '\nRecommended Actions:\n';
            recommendations.forEach((recommendation, index) => {
                message += `${index + 1}. ${recommendation}\n`;
            });
        } else {
            // Fallback recommendations based on error category
            message += '\nRecommended Actions:\n';
            const fallbackRecommendations = this.getFallbackRecommendations(errorCategory);
            fallbackRecommendations.forEach((recommendation, index) => {
                message += `${index + 1}. ${recommendation}\n`;
            });
        }

        // Add Kabila-specific troubleshooting section
        if (this.isKabilaError(errorCategory)) {
            message += this.getKabilaTroubleshootingSection(errorCategory);
        }

        return message;
    }

    /**
     * Categorizes connection errors based on failed validation checks with Kabila-specific categories
     */
    private categorizeConnectionError(checks: ValidationCheck[]): string {
        const failedChecks = checks.filter(check => !check.passed);

        // Check for Kabila-specific errors first
        if (failedChecks.some(check => check.name === 'Kabila Extension State')) {
            const kabilaError = failedChecks.find(check => check.name === 'Kabila Extension State');
            if (kabilaError?.details.includes('not detected')) {
                return 'KABILA_NOT_INSTALLED';
            } else if (kabilaError?.details.includes('locked') || kabilaError?.details.includes('unavailable')) {
                return 'KABILA_LOCKED';
            } else if (kabilaError?.details.includes('disconnected')) {
                return 'KABILA_DISCONNECTED';
            }
            return 'KABILA_EXTENSION_ERROR';
        }

        if (failedChecks.some(check => check.name === 'Kabila Connection Consistency')) {
            return 'KABILA_CONSISTENCY_ERROR';
        }

        // Check for service state errors (most critical)
        if (failedChecks.some(check => check.name === 'Wallet Service State')) {
            return 'SERVICE_ERROR';
        }

        // Check for connection object errors
        if (failedChecks.some(check => check.name === 'Connection Object')) {
            return 'CONNECTION_ERROR';
        }

        // Check for account ID errors
        if (failedChecks.some(check => check.name === 'Account ID')) {
            return 'ACCOUNT_ERROR';
        }

        // Check for stability errors
        if (failedChecks.some(check => check.name === 'Connection Stability')) {
            return 'STABILITY_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Gets fallback recommendations based on error category with Kabila-specific guidance
     */
    private getFallbackRecommendations(errorCategory: string): string[] {
        switch (errorCategory) {
            case 'KABILA_NOT_INSTALLED':
                return [
                    'Install the Kabila wallet extension from the Chrome Web Store',
                    'Visit chrome://extensions/ to verify the extension is installed and enabled',
                    'Refresh the page after installing the extension'
                ];
            case 'KABILA_LOCKED':
                return [
                    'Click on the Kabila extension icon in your browser toolbar',
                    'Enter your password to unlock the Kabila wallet',
                    'Try connecting again after unlocking'
                ];
            case 'KABILA_DISCONNECTED':
                return [
                    'Open the Kabila wallet extension and connect your account',
                    'Ensure you approve any connection requests from the extension',
                    'Try refreshing the page and reconnecting'
                ];
            case 'KABILA_EXTENSION_ERROR':
                return [
                    'Try restarting your browser to reset the extension state',
                    'Disable and re-enable the Kabila extension in chrome://extensions/',
                    'Check if the Kabila extension needs to be updated'
                ];
            case 'KABILA_CONSISTENCY_ERROR':
                return [
                    'Disconnect and reconnect your Kabila wallet to sync state',
                    'Refresh the page to reset the connection state',
                    'Ensure the same account is selected in both app and extension'
                ];
            case 'SERVICE_ERROR':
                return [
                    'Try disconnecting and reconnecting your wallet',
                    'Ensure your wallet extension is unlocked and accessible',
                    'Refresh the page and try connecting again'
                ];
            case 'CONNECTION_ERROR':
                return [
                    'Refresh the page and reconnect your wallet',
                    'Check if your wallet extension is responding properly',
                    'Try switching to a different browser tab and back'
                ];
            case 'ACCOUNT_ERROR':
                return [
                    'Verify your wallet is properly connected and account is selected',
                    'Try switching accounts in your wallet and reconnecting',
                    'Ensure your wallet extension has the correct permissions'
                ];
            case 'STABILITY_ERROR':
                return [
                    'Wait a moment for the connection to stabilize before trying again',
                    'Avoid rapidly switching between wallet accounts or networks',
                    'Try refreshing the page if the issue persists'
                ];
            default:
                return [
                    'Try disconnecting and reconnecting your wallet',
                    'Refresh the page and try again',
                    'Check your wallet extension status'
                ];
        }
    }

    /**
     * Checks if the error category is Kabila-specific
     */
    private isKabilaError(errorCategory: string): boolean {
        return errorCategory.startsWith('KABILA_');
    }

    /**
     * Gets Kabila-specific diagnostic information
     */
    private getKabilaDiagnosticInfo(): string {
        let info = '';

        try {
            if (typeof window !== 'undefined') {
                info += `- Kabila Extension Detected: ${window.kabila ? 'Yes' : 'No'}\n`;

                if (window.kabila) {
                    try {
                        info += `- Kabila Available: ${window.kabila.isAvailable ? 'Yes' : 'No'}\n`;
                        info += `- Kabila Connected: ${window.kabila.isConnected() ? 'Yes' : 'No'}\n`;
                    } catch (error) {
                        info += `- Kabila State Check Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
                    }
                }
            }
        } catch (error) {
            info += `- Kabila Diagnostic Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        }

        return info;
    }

    /**
     * Gets Kabila-specific troubleshooting section
     */
    private getKabilaTroubleshootingSection(errorCategory: string): string {
        let section = '\n🔧 Kabila Wallet Troubleshooting:\n';

        switch (errorCategory) {
            case 'KABILA_NOT_INSTALLED':
                section += '• Download Kabila from: https://chrome.google.com/webstore/detail/kabila-wallet\n';
                section += '• After installation, refresh this page\n';
                section += '• Ensure the extension is enabled in chrome://extensions/\n';
                break;
            case 'KABILA_LOCKED':
                section += '• Look for the Kabila icon in your browser toolbar (usually top-right)\n';
                section += '• Click the icon and enter your wallet password\n';
                section += '• If you forgot your password, you may need to restore from seed phrase\n';
                break;
            case 'KABILA_DISCONNECTED':
                section += '• Open Kabila extension and ensure an account is selected\n';
                section += '• Click "Connect" in this app and approve the request in Kabila\n';
                section += '• Make sure you\'re on the correct Hedera network (mainnet/testnet)\n';
                break;
            case 'KABILA_EXTENSION_ERROR':
                section += '• Try closing and reopening your browser\n';
                section += '• Check if Kabila extension needs an update\n';
                section += '• Clear browser cache and cookies if the issue persists\n';
                break;
            case 'KABILA_CONSISTENCY_ERROR':
                section += '• This usually happens when connection states get out of sync\n';
                section += '• Try disconnecting in both the app and Kabila extension\n';
                section += '• Then reconnect fresh in both places\n';
                break;
        }

        section += '\n💡 Still having issues? Try these general steps:\n';
        section += '• Restart your browser completely\n';
        section += '• Disable other wallet extensions temporarily\n';
        section += '• Try using an incognito/private browser window\n';

        return section;
    }

    /**
     * Formats swap type specific error messages
     */
    formatSwapTypeError(swapType: SwapType, errors: string[]): string {
        if (errors.length === 0) return '';

        let message = '';

        if (swapType === SwapType.CASH_ENABLED) {
            message = `⚠️ Cash-Enabled Swap Configuration Issues\n\n`;
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            message = `⚠️ Booking Exchange Swap Configuration Issues\n\n`;
        }

        errors.forEach((error, index) => {
            message += `${index + 1}. ${error}\n`;
        });

        return message;
    }
}

// Export singleton instance
export const walletValidationService = new WalletValidationService();