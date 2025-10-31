import { EnhancedCreateSwapRequest } from '../types/swap.js';
import { WalletBalanceRequirement } from '../types/wallet-validation.js';

/**
 * Configuration for fee calculations
 */
export interface FeeConfiguration {
    /** Transaction fee in HBAR */
    transactionFee: number;
    /** Platform fee percentage (0.05 = 5%) */
    platformFeePercentage: number;
    /** Minimum balance buffer in HBAR */
    minimumBalance: number;
    /** Currency denomination */
    currency: string;
}

/**
 * Default fee configuration
 */
export const DEFAULT_FEE_CONFIG: FeeConfiguration = {
    transactionFee: 0.1, // 0.1 HBAR
    platformFeePercentage: 0.05, // 5%
    minimumBalance: 0.01, // 0.01 HBAR buffer
    currency: 'HBAR'
};

/**
 * Utility class for calculating balance requirements for swap operations
 */
export class BalanceCalculator {
    private feeConfig: FeeConfiguration;

    constructor(feeConfig: FeeConfiguration = DEFAULT_FEE_CONFIG) {
        this.feeConfig = feeConfig;
    }

    /**
     * Calculates complete balance requirements for a swap creation
     */
    calculateSwapRequirements(swapData: EnhancedCreateSwapRequest): WalletBalanceRequirement {
        // Determine swap type and calculate accordingly
        if (this.isCashEnabledSwap(swapData)) {
            const cashAmount = swapData.paymentTypes.minimumCashAmount || 0;
            return this.calculateCashEnabledRequirements(cashAmount);
        } else {
            return this.calculateBookingExchangeRequirements();
        }
    }

    /**
     * Calculates requirements for a specific swap type
     */
    calculateSwapRequirementsByType(swapData: EnhancedCreateSwapRequest, swapType: 'booking_exchange' | 'cash_enabled'): WalletBalanceRequirement {
        if (swapType === 'cash_enabled') {
            const cashAmount = swapData.paymentTypes.minimumCashAmount || 0;
            return this.calculateCashEnabledRequirements(cashAmount);
        } else {
            return this.calculateBookingExchangeRequirements();
        }
    }

    /**
     * Determines if a swap is cash-enabled
     */
    private isCashEnabledSwap(swapData: EnhancedCreateSwapRequest): boolean {
        return swapData.paymentTypes.cashPayment &&
            (swapData.paymentTypes.minimumCashAmount || 0) > 0;
    }

    /**
     * Calculates transaction fee for blockchain operations
     */
    calculateTransactionFee(): number {
        return this.feeConfig.transactionFee;
    }

    /**
     * Calculates platform fee based on escrow amount
     */
    calculatePlatformFee(escrowAmount: number): number {
        if (escrowAmount <= 0) {
            return 0;
        }
        return escrowAmount * this.feeConfig.platformFeePercentage;
    }

    /**
     * Calculates total required balance including buffer
     */
    calculateTotalRequired(transactionFee: number, escrowAmount: number, platformFee: number): number {
        return transactionFee + escrowAmount + platformFee + this.feeConfig.minimumBalance;
    }

    /**
     * Calculates requirements specifically for booking exchange swaps (no cash)
     */
    calculateBookingExchangeRequirements(): WalletBalanceRequirement {
        const transactionFee = this.calculateTransactionFee();
        const escrowAmount = 0; // No escrow for booking-only swaps
        const platformFee = 0; // No platform fee for booking-only swaps
        const totalRequired = this.calculateTotalRequired(transactionFee, escrowAmount, platformFee);

        return {
            transactionFee,
            escrowAmount,
            platformFee,
            totalRequired,
            currency: this.feeConfig.currency
        };
    }

    /**
     * Calculates requirements specifically for cash-enabled swaps
     */
    calculateCashEnabledRequirements(cashAmount: number): WalletBalanceRequirement {
        const transactionFee = this.calculateTransactionFee();
        const escrowAmount = cashAmount;
        const platformFee = this.calculatePlatformFee(escrowAmount);
        const totalRequired = this.calculateTotalRequired(transactionFee, escrowAmount, platformFee);

        return {
            transactionFee,
            escrowAmount,
            platformFee,
            totalRequired,
            currency: this.feeConfig.currency
        };
    }

    /**
     * Calculates escrow amount based on swap configuration
     */
    private calculateEscrowAmount(swapData: EnhancedCreateSwapRequest): number {
        // For booking exchange only swaps, no escrow is required
        if (!swapData.paymentTypes.cashPayment) {
            return 0;
        }

        // For cash-enabled swaps, use minimum cash amount as escrow
        return swapData.paymentTypes.minimumCashAmount || 0;
    }

    /**
     * Updates fee configuration
     */
    updateFeeConfiguration(newConfig: Partial<FeeConfiguration>): void {
        this.feeConfig = { ...this.feeConfig, ...newConfig };
    }

    /**
     * Gets current fee configuration
     */
    getFeeConfiguration(): FeeConfiguration {
        return { ...this.feeConfig };
    }
}

// Export singleton instance with default configuration
export const balanceCalculator = new BalanceCalculator();