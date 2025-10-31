import { Response } from 'express';
import { logger } from './logger';
import { WalletBalanceValidation, WalletBalanceRequirement } from '@booking-swap/shared';

/**
 * Wallet validation error codes
 */
export enum WalletValidationErrorCodes {
    WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
    INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
    INSUFFICIENT_WALLET_BALANCE = 'INSUFFICIENT_WALLET_BALANCE',
    WALLET_BALANCE_CHECK_FAILED = 'WALLET_BALANCE_CHECK_FAILED',
    BLOCKCHAIN_NETWORK_ERROR = 'BLOCKCHAIN_NETWORK_ERROR',
    WALLET_VALIDATION_TIMEOUT = 'WALLET_VALIDATION_TIMEOUT',
    UNSUPPORTED_WALLET_NETWORK = 'UNSUPPORTED_WALLET_NETWORK'
}

/**
 * Wallet validation error categories
 */
export enum WalletValidationErrorCategories {
    CONNECTION = 'connection',
    BALANCE = 'balance',
    VALIDATION = 'validation',
    NETWORK = 'network',
    SYSTEM = 'system'
}

/**
 * Structured wallet validation error
 */
export interface WalletValidationError {
    code: WalletValidationErrorCodes;
    message: string;
    category: WalletValidationErrorCategories;
    details?: Record<string, any>;
    suggestions?: string[];
    httpStatusCode: number;
}

/**
 * Audit log entry for validation failures
 */
export interface WalletValidationAuditLog {
    timestamp: Date;
    userId?: string;
    walletAddress?: string;
    errorCode: WalletValidationErrorCodes;
    errorMessage: string;
    requestId?: string;
    operation: string;
    balanceDetails?: {
        currentBalance?: number;
        requiredBalance?: number;
        shortfall?: number;
        currency?: string;
    };
    technicalDetails?: Record<string, any>;
}

/**
 * Create structured error response for wallet validation failures
 */
export function createWalletValidationError(
    code: WalletValidationErrorCodes,
    message: string,
    category: WalletValidationErrorCategories,
    details?: Record<string, any>,
    suggestions?: string[]
): WalletValidationError {
    const httpStatusCode = getHttpStatusCodeForError(code);

    return {
        code,
        message,
        category,
        details,
        suggestions,
        httpStatusCode
    };
}

/**
 * Handle wallet connection errors
 */
export function handleWalletConnectionError(
    walletAddress?: string,
    technicalError?: string
): WalletValidationError {
    return createWalletValidationError(
        WalletValidationErrorCodes.WALLET_NOT_CONNECTED,
        'Wallet connection required. Please connect your wallet before creating a swap.',
        WalletValidationErrorCategories.CONNECTION,
        {
            providedAddress: walletAddress,
            technicalError
        },
        [
            'Connect your Hedera wallet',
            'Ensure wallet is unlocked',
            'Check wallet network settings'
        ]
    );
}

/**
 * Handle invalid wallet address errors
 */
export function handleInvalidWalletAddressError(
    walletAddress: string
): WalletValidationError {
    return createWalletValidationError(
        WalletValidationErrorCodes.INVALID_WALLET_ADDRESS,
        'Invalid wallet address format. Expected Hedera account ID format (0.0.123456).',
        WalletValidationErrorCategories.VALIDATION,
        {
            providedAddress: walletAddress,
            expectedFormat: '0.0.123456',
            validationPattern: '^\\d+\\.\\d+\\.\\d+$'
        },
        [
            'Check wallet address format',
            'Ensure using Hedera account ID',
            'Copy address directly from wallet'
        ]
    );
}

/**
 * Handle insufficient balance errors
 */
export function handleInsufficientBalanceError(
    balanceValidation: WalletBalanceValidation,
    walletAddress: string
): WalletValidationError {
    const requirement = balanceValidation.requirement;
    const breakdown = generateBalanceBreakdown(requirement);

    return createWalletValidationError(
        WalletValidationErrorCodes.INSUFFICIENT_WALLET_BALANCE,
        `Insufficient wallet balance. You need ${balanceValidation.shortfall} more ${requirement.currency}.`,
        WalletValidationErrorCategories.BALANCE,
        {
            walletAddress,
            currentBalance: balanceValidation.currentBalance,
            requiredBalance: requirement.totalRequired,
            shortfall: balanceValidation.shortfall,
            currency: requirement.currency,
            breakdown,
            balanceCheck: 'hedera_blockchain_verified'
        },
        [
            `Add ${balanceValidation.shortfall} ${requirement.currency} to your wallet`,
            'Check wallet balance in your Hedera wallet app',
            'Consider reducing swap amount if applicable'
        ]
    );
}

/**
 * Handle blockchain network errors
 */
export function handleBlockchainNetworkError(
    walletAddress: string,
    technicalError: string
): WalletValidationError {
    return createWalletValidationError(
        WalletValidationErrorCodes.BLOCKCHAIN_NETWORK_ERROR,
        'Unable to connect to Hedera network. Please try again.',
        WalletValidationErrorCategories.NETWORK,
        {
            walletAddress,
            technicalError,
            network: 'hedera'
        },
        [
            'Check internet connection',
            'Try again in a few moments',
            'Verify Hedera network status'
        ]
    );
}

/**
 * Handle validation timeout errors
 */
export function handleValidationTimeoutError(
    walletAddress: string,
    timeoutDuration: number
): WalletValidationError {
    return createWalletValidationError(
        WalletValidationErrorCodes.WALLET_VALIDATION_TIMEOUT,
        'Wallet validation timed out. Please try again.',
        WalletValidationErrorCategories.SYSTEM,
        {
            walletAddress,
            timeoutDuration,
            timeoutUnit: 'milliseconds'
        },
        [
            'Try again with a stable connection',
            'Check Hedera network status',
            'Contact support if issue persists'
        ]
    );
}

/**
 * Send structured error response
 */
export function sendWalletValidationErrorResponse(
    res: Response,
    error: WalletValidationError,
    requestId?: string
): void {
    res.status(error.httpStatusCode).json({
        error: {
            code: error.code,
            message: error.message,
            category: error.category,
            details: error.details,
            suggestions: error.suggestions
        },
        requestId,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log wallet validation failure for audit purposes
 */
export function logWalletValidationFailure(
    auditLog: WalletValidationAuditLog
): void {
    logger.warn('Wallet validation failure', {
        timestamp: auditLog.timestamp.toISOString(),
        userId: auditLog.userId,
        walletAddress: auditLog.walletAddress ? `${auditLog.walletAddress.substring(0, 10)}...` : undefined,
        errorCode: auditLog.errorCode,
        errorMessage: auditLog.errorMessage,
        requestId: auditLog.requestId,
        operation: auditLog.operation,
        balanceDetails: auditLog.balanceDetails,
        technicalDetails: auditLog.technicalDetails,
        category: 'wallet_validation_audit'
    });

    // Log to separate audit trail if configured
    // Note: Audit logging would be implemented separately if needed
}

/**
 * Generate balance breakdown for user display
 */
function generateBalanceBreakdown(requirement: WalletBalanceRequirement): Array<{ item: string; amount: number; currency: string }> {
    const breakdown = [];

    if (requirement.transactionFee > 0) {
        breakdown.push({
            item: 'Transaction Fee',
            amount: requirement.transactionFee,
            currency: requirement.currency
        });
    }

    if (requirement.escrowAmount > 0) {
        breakdown.push({
            item: 'Escrow Amount',
            amount: requirement.escrowAmount,
            currency: requirement.currency
        });
    }

    if (requirement.platformFee > 0) {
        breakdown.push({
            item: 'Platform Fee',
            amount: requirement.platformFee,
            currency: requirement.currency
        });
    }

    return breakdown;
}

/**
 * Get appropriate HTTP status code for error type
 */
function getHttpStatusCodeForError(code: WalletValidationErrorCodes): number {
    switch (code) {
        case WalletValidationErrorCodes.WALLET_NOT_CONNECTED:
        case WalletValidationErrorCodes.INVALID_WALLET_ADDRESS:
        case WalletValidationErrorCodes.INSUFFICIENT_WALLET_BALANCE:
        case WalletValidationErrorCodes.UNSUPPORTED_WALLET_NETWORK:
            return 400; // Bad Request

        case WalletValidationErrorCodes.BLOCKCHAIN_NETWORK_ERROR:
            return 503; // Service Unavailable

        case WalletValidationErrorCodes.WALLET_BALANCE_CHECK_FAILED:
        case WalletValidationErrorCodes.WALLET_VALIDATION_TIMEOUT:
            return 500; // Internal Server Error

        default:
            return 500;
    }
}

/**
 * Create audit log entry for validation failure
 */
export function createWalletValidationAuditLog(
    errorCode: WalletValidationErrorCodes,
    errorMessage: string,
    operation: string,
    options: {
        userId?: string;
        walletAddress?: string;
        requestId?: string;
        balanceDetails?: {
            currentBalance?: number;
            requiredBalance?: number;
            shortfall?: number;
            currency?: string;
        };
        technicalDetails?: Record<string, any>;
    } = {}
): WalletValidationAuditLog {
    return {
        timestamp: new Date(),
        userId: options.userId,
        walletAddress: options.walletAddress,
        errorCode,
        errorMessage,
        requestId: options.requestId,
        operation,
        balanceDetails: options.balanceDetails,
        technicalDetails: options.technicalDetails
    };
}