import { Request, Response, NextFunction } from 'express';
import { HederaBalanceService } from '../services/hedera/HederaBalanceService';
import { BalanceCalculator, EnhancedCreateSwapRequest } from '@booking-swap/shared';
import { logger } from '../utils/logger';

/**
 * Swap type enumeration for backend validation
 */
export enum SwapType {
    BOOKING_EXCHANGE = 'booking_exchange',
    CASH_ENABLED = 'cash_enabled'
}

/**
 * Middleware for validating wallet requirements before swap creation
 */
export interface WalletValidationMiddleware {
    validateWalletForSwapCreation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

/**
 * Create wallet validation middleware
 */
export function createWalletValidationMiddleware(
    hederaBalanceService: HederaBalanceService,
    balanceCalculator: BalanceCalculator
): WalletValidationMiddleware {

    const validateWalletForSwapCreation = async (req: any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { walletAddress } = req.body;
            const userId = req.user?.id;

            // Skip validation if no wallet address provided (will be caught by other validation)
            if (!walletAddress) {
                next();
                return;
            }

            logger.info('Starting wallet validation for swap creation', {
                userId,
                walletAddress,
                requestPath: req.path
            });

            // Validate wallet address format
            if (!isValidHederaAccountId(walletAddress)) {
                res.status(400).json({
                    error: {
                        code: 'INVALID_WALLET_ADDRESS',
                        message: 'Invalid wallet address format. Expected Hedera account ID format (0.0.123456)',
                        category: 'validation',
                        details: {
                            providedAddress: walletAddress,
                            expectedFormat: '0.0.123456'
                        }
                    }
                });
                return;
            }

            // Determine swap type and perform type-specific validation
            const swapType = determineSwapType(req.body);
            const typeValidationErrors = validateSwapTypeSpecific(req.body, swapType);

            if (typeValidationErrors.length > 0) {
                logger.warn('Swap type validation failed', {
                    userId,
                    walletAddress,
                    swapType,
                    errors: typeValidationErrors
                });

                res.status(400).json({
                    error: {
                        code: 'INVALID_SWAP_CONFIGURATION',
                        message: `Invalid configuration for ${swapType} swap`,
                        category: 'validation',
                        details: {
                            swapType,
                            validationErrors: typeValidationErrors
                        }
                    }
                });
                return;
            }

            // Calculate balance requirements based on swap data
            const balanceRequirement = balanceCalculator.calculateSwapRequirements(req.body);

            // Validate wallet balance
            const balanceValidation = await hederaBalanceService.validateSufficientBalance(
                walletAddress,
                balanceRequirement
            );

            if (!balanceValidation.isSufficient) {
                logger.warn('Wallet validation failed - insufficient balance', {
                    userId,
                    walletAddress,
                    swapType,
                    currentBalance: balanceValidation.currentBalance,
                    requiredBalance: balanceValidation.requirement.totalRequired,
                    shortfall: balanceValidation.shortfall
                });

                const errorMessage = formatSwapTypeBalanceError(
                    swapType,
                    balanceValidation.currentBalance,
                    balanceValidation.requirement,
                    balanceValidation.shortfall || 0
                );

                res.status(400).json({
                    error: {
                        code: 'INSUFFICIENT_WALLET_BALANCE',
                        message: errorMessage,
                        category: 'validation',
                        details: {
                            swapType,
                            currentBalance: balanceValidation.currentBalance,
                            requirement: balanceValidation.requirement,
                            shortfall: balanceValidation.shortfall,
                            currency: balanceValidation.requirement.currency
                        }
                    }
                });
                return;
            }

            logger.info('Wallet validation passed', {
                userId,
                walletAddress,
                currentBalance: balanceValidation.currentBalance,
                requiredBalance: balanceValidation.requirement.totalRequired
            });

            // Add validation results to request for use in controller
            (req as any).walletValidation = {
                isValid: true,
                swapType,
                balanceValidation,
                balanceRequirement
            };

            next();
        } catch (error: any) {
            logger.error('Wallet validation middleware error', {
                error: error.message,
                errorStack: error.stack,
                userId: req.user?.id,
                walletAddress: req.body.walletAddress,
                requestPath: req.path
            });

            res.status(500).json({
                error: {
                    code: 'WALLET_VALIDATION_FAILED',
                    message: 'Unable to validate wallet. Please try again.',
                    category: 'system',
                    details: {
                        technicalError: error.message
                    }
                }
            });
        }
    };

    return { validateWalletForSwapCreation };
}

/**
 * Validate Hedera account ID format
 */
function isValidHederaAccountId(accountId: string): boolean {
    // Hedera account ID format: shard.realm.account (e.g., 0.0.123456)
    const hederaAccountPattern = /^\d+\.\d+\.\d+$/;
    return hederaAccountPattern.test(accountId);
}

/**
 * Determines the swap type based on payment configuration
 */
function determineSwapType(swapData: EnhancedCreateSwapRequest): SwapType {
    const { paymentTypes } = swapData;

    // If cash payment is enabled and has a minimum amount, it's cash-enabled
    if (paymentTypes.cashPayment && (paymentTypes.minimumCashAmount || 0) > 0) {
        return SwapType.CASH_ENABLED;
    }

    // Otherwise, it's a booking exchange only
    return SwapType.BOOKING_EXCHANGE;
}

/**
 * Validates swap type specific requirements using standardized validation
 */
function validateSwapTypeSpecific(swapData: EnhancedCreateSwapRequest, swapType: SwapType): string[] {
    const errors: string[] = [];
    const { paymentTypes } = swapData;

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
 * Formats swap type specific balance error messages
 */
function formatSwapTypeBalanceError(
    swapType: SwapType,
    currentBalance: number,
    requirement: any,
    shortfall: number
): string {
    let message = '';

    if (swapType === SwapType.CASH_ENABLED) {
        message = `Insufficient wallet balance for cash-enabled swap. `;
        message += `Cash-enabled swaps require funds for escrow (${requirement.escrowAmount} ${requirement.currency}), `;
        message += `platform fees (${requirement.platformFee} ${requirement.currency}), and transaction costs (${requirement.transactionFee} ${requirement.currency}). `;
    } else if (swapType === SwapType.BOOKING_EXCHANGE) {
        message = `Insufficient wallet balance for booking exchange swap. `;
        message += `Booking exchange swaps require funds for transaction costs only (${requirement.transactionFee} ${requirement.currency}). `;
    }

    message += `Current balance: ${currentBalance.toFixed(2)} ${requirement.currency}, `;
    message += `Required: ${requirement.totalRequired.toFixed(2)} ${requirement.currency}, `;
    message += `Shortfall: ${shortfall.toFixed(2)} ${requirement.currency}.`;

    return message;
}

/**
 * Extended Request interface with wallet validation results
 */
export interface RequestWithWalletValidation {
    walletValidation?: {
        isValid: boolean;
        swapType: SwapType;
        balanceValidation: any;
        balanceRequirement: any;
    };
}