/**
 * Financial Data Handler Utility
 * Handles currency formatting and amount validation to prevent $NaN displays
 * Requirements: 4.1, 4.2, 4.3, 4.4 from the design document
 */
export class FinancialDataHandler {
    /**
     * Format currency amount with proper validation
     * Prevents $NaN displays by handling null/undefined/invalid values gracefully
     */
    static formatCurrency(amount: any, currency: string = 'USD'): string {
        // Handle null, undefined, or empty values
        if (amount === null || amount === undefined || amount === '') {
            return 'Price not set';
        }

        // Convert to number and validate
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount)) {
            return 'Invalid price';
        }

        // Handle negative values
        if (numericAmount < 0) {
            return 'Invalid price';
        }

        // Get currency symbol
        const currencySymbol = this.getCurrencySymbol(currency);

        // Format with proper decimal places
        return `${currencySymbol}${numericAmount.toFixed(2)}`;
    }

    /**
     * Validate and sanitize amount values
     * Returns null for invalid values, number for valid ones
     */
    static validateAmount(amount: any): number | null {
        if (amount === null || amount === undefined || amount === '') {
            return null;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            return null;
        }

        return numericAmount;
    }

    /**
     * Get currency symbol for a given currency code
     */
    static getCurrencySymbol(currency: string): string {
        const currencySymbols: Record<string, string> = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'CAD': 'C$',
            'AUD': 'A$',
            'CHF': 'CHF ',
            'CNY': '¥',
            'SEK': 'kr',
            'NOK': 'kr',
            'DKK': 'kr',
            'PLN': 'zł',
            'CZK': 'Kč',
            'HUF': 'Ft',
            'RUB': '₽',
            'BRL': 'R$',
            'INR': '₹',
            'KRW': '₩',
            'SGD': 'S$',
            'HKD': 'HK$',
            'NZD': 'NZ$',
            'MXN': 'MX$',
            'ZAR': 'R',
            'TRY': '₺',
            'ILS': '₪'
        };

        return currencySymbols[currency.toUpperCase()] || `${currency.toUpperCase()} `;
    }

    /**
     * Format currency for display in different contexts
     */
    static formatCurrencyForContext(
        amount: any,
        currency: string = 'USD',
        context: 'card' | 'detail' | 'summary' = 'card'
    ): string {
        const validatedAmount = this.validateAmount(amount);

        if (validatedAmount === null) {
            switch (context) {
                case 'card':
                    return 'Price TBD';
                case 'detail':
                    return 'Price not available';
                case 'summary':
                    return 'N/A';
                default:
                    return 'Price not set';
            }
        }

        const currencySymbol = this.getCurrencySymbol(currency);

        switch (context) {
            case 'card':
                // Shorter format for cards
                if (validatedAmount >= 1000) {
                    return `${currencySymbol}${(validatedAmount / 1000).toFixed(1)}k`;
                }
                return `${currencySymbol}${validatedAmount.toFixed(0)}`;

            case 'detail':
                // Full format for detailed views
                return `${currencySymbol}${validatedAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;

            case 'summary':
                // Compact format for summaries
                return `${currencySymbol}${validatedAmount.toFixed(2)}`;

            default:
                return `${currencySymbol}${validatedAmount.toFixed(2)}`;
        }
    }

    /**
     * Calculate percentage difference between two amounts
     */
    static calculatePercentageDifference(amount1: any, amount2: any): string {
        const val1 = this.validateAmount(amount1);
        const val2 = this.validateAmount(amount2);

        if (val1 === null || val2 === null || val1 === 0) {
            return 'N/A';
        }

        const difference = ((val2 - val1) / val1) * 100;
        const sign = difference >= 0 ? '+' : '';

        return `${sign}${difference.toFixed(1)}%`;
    }

    /**
     * Compare two currency amounts
     */
    static compareAmounts(amount1: any, amount2: any): 'higher' | 'lower' | 'equal' | 'invalid' {
        const val1 = this.validateAmount(amount1);
        const val2 = this.validateAmount(amount2);

        if (val1 === null || val2 === null) {
            return 'invalid';
        }

        if (val1 > val2) return 'higher';
        if (val1 < val2) return 'lower';
        return 'equal';
    }

    /**
     * Validate currency code
     */
    static isValidCurrency(currency: string): boolean {
        const validCurrencies = [
            'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
            'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'BRL',
            'INR', 'KRW', 'SGD', 'HKD', 'NZD', 'MXN', 'ZAR', 'TRY', 'ILS'
        ];

        return validCurrencies.includes(currency.toUpperCase());
    }

    /**
     * Get default currency based on locale or user preference
     */
    static getDefaultCurrency(): string {
        // Try to get from user preferences first
        const userCurrency = localStorage.getItem('user_preferred_currency');
        if (userCurrency && this.isValidCurrency(userCurrency)) {
            return userCurrency;
        }

        // Fallback to locale-based detection
        try {
            const locale = navigator.language || 'en-US';
            const localeMap: Record<string, string> = {
                'en-US': 'USD',
                'en-GB': 'GBP',
                'de-DE': 'EUR',
                'fr-FR': 'EUR',
                'es-ES': 'EUR',
                'it-IT': 'EUR',
                'ja-JP': 'JPY',
                'ko-KR': 'KRW',
                'zh-CN': 'CNY',
                'en-CA': 'CAD',
                'en-AU': 'AUD',
                'pt-BR': 'BRL',
                'ru-RU': 'RUB',
                'hi-IN': 'INR'
            };

            return localeMap[locale] || 'USD';
        } catch (error) {
            return 'USD';
        }
    }
}

export default FinancialDataHandler;