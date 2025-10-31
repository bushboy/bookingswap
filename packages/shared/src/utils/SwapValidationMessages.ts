/**
 * Swap type enumeration for validation messages
 */
export enum SwapType {
    BOOKING_EXCHANGE = 'booking_exchange',
    CASH_ENABLED = 'cash_enabled'
}

/**
 * Standardized error messages for swap validation
 */
export class SwapValidationMessages {
    /**
     * Get connection error message based on swap type
     */
    static getConnectionError(swapType: SwapType): string {
        switch (swapType) {
            case SwapType.CASH_ENABLED:
                return 'Wallet connection required for cash-enabled swap. This is needed for blockchain transaction fees, escrow deposits, and platform fees.';
            case SwapType.BOOKING_EXCHANGE:
                return 'Wallet connection required for booking exchange swap. This is needed for blockchain transaction fees.';
            default:
                return 'Wallet connection required for swap creation. This is needed for blockchain transaction fees and escrow.';
        }
    }

    /**
     * Get balance error message based on swap type
     */
    static getBalanceError(swapType: SwapType): string {
        switch (swapType) {
            case SwapType.CASH_ENABLED:
                return 'Insufficient wallet balance for cash-enabled swap creation.';
            case SwapType.BOOKING_EXCHANGE:
                return 'Insufficient wallet balance for booking exchange swap creation.';
            default:
                return 'Insufficient wallet balance for swap creation.';
        }
    }

    /**
     * Get detailed balance error with breakdown
     */
    static getDetailedBalanceError(
        swapType: SwapType,
        currentBalance: number,
        requirement: {
            transactionFee: number;
            escrowAmount: number;
            platformFee: number;
            totalRequired: number;
            currency: string;
        },
        shortfall: number
    ): string {
        let message = this.getBalanceError(swapType) + '\n\n';

        if (swapType === SwapType.CASH_ENABLED) {
            message += 'Cash-enabled swaps require funds for escrow deposits, platform fees, and transaction costs.\n\n';
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            message += 'Booking exchange swaps require funds for transaction costs only.\n\n';
        }

        message += `Current Balance: ${currentBalance.toFixed(2)} ${requirement.currency}\n`;
        message += `Required Amount: ${requirement.totalRequired.toFixed(2)} ${requirement.currency}\n`;
        message += `  - Transaction Fee: ${requirement.transactionFee.toFixed(2)} ${requirement.currency}\n`;

        if (requirement.escrowAmount > 0) {
            message += `  - Escrow Amount: ${requirement.escrowAmount.toFixed(2)} ${requirement.currency}\n`;
            message += `  - Platform Fee: ${requirement.platformFee.toFixed(2)} ${requirement.currency}\n`;
        }

        message += `\nShortfall: ${shortfall.toFixed(2)} ${requirement.currency}\n\n`;
        message += 'Please add funds to your wallet before creating this swap.';

        return message;
    }

    /**
     * Get guidance message based on swap type
     */
    static getGuidanceMessage(swapType: SwapType): string {
        switch (swapType) {
            case SwapType.CASH_ENABLED:
                return 'For cash-enabled swaps, you need funds for escrow deposits, platform fees, and transaction costs. Please add funds to your wallet before creating this swap.';
            case SwapType.BOOKING_EXCHANGE:
                return 'For booking exchange swaps, you only need to cover transaction fees. Please add funds to your wallet before creating this swap.';
            default:
                return 'Please add funds to your wallet before creating this swap.';
        }
    }

    /**
     * Get swap type specific validation error title
     */
    static getValidationErrorTitle(swapType: SwapType): string {
        switch (swapType) {
            case SwapType.CASH_ENABLED:
                return 'Cash-Enabled Swap Configuration Issues';
            case SwapType.BOOKING_EXCHANGE:
                return 'Booking Exchange Swap Configuration Issues';
            default:
                return 'Swap Configuration Issues';
        }
    }

    /**
     * Get cash-enabled swap validation errors
     */
    static validateCashEnabledSwap(paymentTypes: {
        cashPayment: boolean;
        minimumCashAmount?: number;
    }): string[] {
        const errors: string[] = [];

        // Validate minimum cash amount
        if (!paymentTypes.minimumCashAmount || paymentTypes.minimumCashAmount <= 0) {
            errors.push('Cash-enabled swaps must specify a minimum cash amount greater than 0');
        }

        // Validate cash amount is reasonable (not too small for escrow fees)
        if (paymentTypes.minimumCashAmount && paymentTypes.minimumCashAmount < 1) {
            errors.push('Minimum cash amount should be at least 1 HBAR to cover platform fees');
        }

        return errors;
    }

    /**
     * Get booking exchange swap validation errors
     */
    static validateBookingExchangeSwap(paymentTypes: {
        bookingExchange: boolean;
        cashPayment: boolean;
        minimumCashAmount?: number;
    }): string[] {
        const errors: string[] = [];

        // Ensure booking exchange is enabled for booking-only swaps
        if (!paymentTypes.bookingExchange) {
            errors.push('Booking exchange must be enabled for booking-only swaps');
        }

        // Warn if cash payment is enabled but no minimum amount is set
        if (paymentTypes.cashPayment && !paymentTypes.minimumCashAmount) {
            errors.push('Cash payment is enabled but no minimum amount is specified. This will be treated as a booking-only swap.');
        }

        return errors;
    }

    /**
     * Determine swap type from payment configuration
     */
    static determineSwapType(paymentTypes: {
        cashPayment: boolean;
        minimumCashAmount?: number;
    }): SwapType {
        // If cash payment is enabled and has a minimum amount, it's cash-enabled
        if (paymentTypes.cashPayment && (paymentTypes.minimumCashAmount || 0) > 0) {
            return SwapType.CASH_ENABLED;
        }

        // Otherwise, it's a booking exchange only
        return SwapType.BOOKING_EXCHANGE;
    }

    /**
     * Get all validation errors for a swap type
     */
    static validateSwapType(
        swapType: SwapType,
        paymentTypes: {
            bookingExchange: boolean;
            cashPayment: boolean;
            minimumCashAmount?: number;
        }
    ): string[] {
        if (swapType === SwapType.CASH_ENABLED) {
            return this.validateCashEnabledSwap(paymentTypes);
        } else if (swapType === SwapType.BOOKING_EXCHANGE) {
            return this.validateBookingExchangeSwap(paymentTypes);
        }
        return [];
    }
}