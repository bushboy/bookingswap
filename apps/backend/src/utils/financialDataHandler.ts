/**
 * Financial Data Handler for Swap Card Display Accuracy
 * Requirements: 4.1, 4.2, 4.3 - Handle financial data validation and formatting
 */

export interface ValidatedPricing {
    amount: number | null;
    currency: string;
    formatted: string;
}

export interface CurrencyConfig {
    symbol: string;
    code: string;
    decimals: number;
}

export class FinancialDataHandler {
    private static readonly SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
        EUR: { symbol: '€', code: 'EUR', decimals: 2 },
        USD: { symbol: '$', code: 'USD', decimals: 2 },
        GBP: { symbol: '£', code: 'GBP', decimals: 2 },
        BTC: { symbol: '₿', code: 'BTC', decimals: 8 },
        ETH: { symbol: 'Ξ', code: 'ETH', decimals: 6 }
    };

    private static readonly DEFAULT_CURRENCY = 'EUR';

    /**
     * Format currency amount with proper validation and fallbacks
     * Requirements: 4.1, 4.2 - Eliminate $NaN displays and handle null/undefined values
     */
    static formatCurrency(amount: any, currency: string = this.DEFAULT_CURRENCY): string {
        // Handle null, undefined, or empty values
        if (amount === null || amount === undefined || amount === '') {
            return 'Price not set';
        }

        // Validate and parse the amount
        const validatedAmount = this.validateAmount(amount);
        if (validatedAmount === null) {
            return 'Invalid price';
        }

        // Get currency configuration
        const currencyConfig = this.getCurrencyConfig(currency);

        // Format the amount with appropriate decimals
        const formattedAmount = validatedAmount.toFixed(currencyConfig.decimals);

        return `${currencyConfig.symbol}${formattedAmount}`;
    }

    /**
     * Validate and sanitize amount values
     * Requirements: 4.3 - Add validation for numeric amounts before calculations
     */
    static validateAmount(amount: any): number | null {
        // Handle null, undefined, or empty string
        if (amount === null || amount === undefined || amount === '') {
            return null;
        }

        // Handle string inputs
        if (typeof amount === 'string') {
            // Remove currency symbols and whitespace
            const cleanAmount = amount.replace(/[€$£₿Ξ\s,]/g, '');

            // Check if empty after cleaning
            if (cleanAmount === '') {
                return null;
            }

            const parsed = parseFloat(cleanAmount);
            return isNaN(parsed) ? null : parsed;
        }

        // Handle numeric inputs
        if (typeof amount === 'number') {
            return isNaN(amount) || !isFinite(amount) ? null : amount;
        }

        // Handle other types
        const parsed = parseFloat(String(amount));
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Get currency configuration with fallback
     */
    private static getCurrencyConfig(currency: string): CurrencyConfig {
        const upperCurrency = currency?.toUpperCase();
        return this.SUPPORTED_CURRENCIES[upperCurrency] || this.SUPPORTED_CURRENCIES[this.DEFAULT_CURRENCY]!;
    }

    /**
     * Validate and sanitize complete pricing data
     * Requirements: 4.1, 4.2, 4.3 - Comprehensive pricing validation
     */
    static validatePricing(pricingData: any): ValidatedPricing {
        if (!pricingData || typeof pricingData !== 'object') {
            return {
                amount: null,
                currency: this.DEFAULT_CURRENCY,
                formatted: 'Price not set'
            };
        }

        const validatedAmount = this.validateAmount(pricingData.amount);
        const currency = pricingData.currency || this.DEFAULT_CURRENCY;

        return {
            amount: validatedAmount,
            currency,
            formatted: this.formatCurrency(validatedAmount, currency)
        };
    }

    /**
     * Check if an amount is valid for calculations
     * Requirements: 4.3 - Validation before performing calculations
     */
    static isValidForCalculation(amount: any): boolean {
        const validated = this.validateAmount(amount);
        return validated !== null && validated >= 0;
    }

    /**
     * Safely perform arithmetic operations on amounts
     * Requirements: 4.3 - Handle null/undefined values gracefully in calculations
     */
    static safeAdd(amount1: any, amount2: any): number | null {
        const val1 = this.validateAmount(amount1);
        const val2 = this.validateAmount(amount2);

        if (val1 === null || val2 === null) {
            return null;
        }

        return val1 + val2;
    }

    static safeSubtract(amount1: any, amount2: any): number | null {
        const val1 = this.validateAmount(amount1);
        const val2 = this.validateAmount(amount2);

        if (val1 === null || val2 === null) {
            return null;
        }

        return val1 - val2;
    }

    static safeMultiply(amount: any, multiplier: any): number | null {
        const val1 = this.validateAmount(amount);
        const val2 = this.validateAmount(multiplier);

        if (val1 === null || val2 === null) {
            return null;
        }

        return val1 * val2;
    }

    /**
     * Format percentage values safely
     */
    static formatPercentage(value: any, decimals: number = 1): string {
        const validated = this.validateAmount(value);
        if (validated === null) {
            return 'N/A';
        }

        return `${validated.toFixed(decimals)}%`;
    }

    /**
     * Compare two amounts safely
     */
    static compareAmounts(amount1: any, amount2: any): number | null {
        const val1 = this.validateAmount(amount1);
        const val2 = this.validateAmount(amount2);

        if (val1 === null || val2 === null) {
            return null;
        }

        if (val1 > val2) return 1;
        if (val1 < val2) return -1;
        return 0;
    }

    /**
     * Get supported currencies list
     */
    static getSupportedCurrencies(): CurrencyConfig[] {
        return Object.values(this.SUPPORTED_CURRENCIES);
    }

    /**
     * Check if currency is supported
     */
    static isSupportedCurrency(currency: string): boolean {
        return currency?.toUpperCase() in this.SUPPORTED_CURRENCIES;
    }
}