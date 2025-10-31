/**
 * Tests for FinancialDataHandler
 * Requirements: 4.1, 4.2, 4.3, 4.4 - Validate financial data handling and $NaN elimination
 */

import { FinancialDataHandler } from '../financialDataHandler';

describe('FinancialDataHandler', () => {
    describe('formatCurrency', () => {
        it('should format valid numbers correctly', () => {
            expect(FinancialDataHandler.formatCurrency(100, 'USD')).toBe('$100.00');
            expect(FinancialDataHandler.formatCurrency(99.99, 'EUR')).toBe('€99.99');
            expect(FinancialDataHandler.formatCurrency(0, 'USD')).toBe('$0.00');
        });

        it('should handle null and undefined values', () => {
            expect(FinancialDataHandler.formatCurrency(null)).toBe('Price not set');
            expect(FinancialDataHandler.formatCurrency(undefined)).toBe('Price not set');
            expect(FinancialDataHandler.formatCurrency('')).toBe('Price not set');
        });

        it('should handle invalid values', () => {
            expect(FinancialDataHandler.formatCurrency(NaN)).toBe('Invalid price');
            expect(FinancialDataHandler.formatCurrency('invalid')).toBe('Invalid price');
            expect(FinancialDataHandler.formatCurrency(Infinity)).toBe('Invalid price');
        });

        it('should handle string numbers', () => {
            expect(FinancialDataHandler.formatCurrency('100')).toBe('$100.00');
            expect(FinancialDataHandler.formatCurrency('99.99')).toBe('$99.99');
            expect(FinancialDataHandler.formatCurrency('$100')).toBe('$100.00');
        });

        it('should use default currency when not specified', () => {
            expect(FinancialDataHandler.formatCurrency(100)).toBe('$100.00');
        });
    });

    describe('validateAmount', () => {
        it('should validate numeric values', () => {
            expect(FinancialDataHandler.validateAmount(100)).toBe(100);
            expect(FinancialDataHandler.validateAmount(0)).toBe(0);
            expect(FinancialDataHandler.validateAmount(-50)).toBe(-50);
        });

        it('should return null for invalid values', () => {
            expect(FinancialDataHandler.validateAmount(null)).toBe(null);
            expect(FinancialDataHandler.validateAmount(undefined)).toBe(null);
            expect(FinancialDataHandler.validateAmount('')).toBe(null);
            expect(FinancialDataHandler.validateAmount(NaN)).toBe(null);
            expect(FinancialDataHandler.validateAmount(Infinity)).toBe(null);
        });

        it('should parse string values', () => {
            expect(FinancialDataHandler.validateAmount('100')).toBe(100);
            expect(FinancialDataHandler.validateAmount('99.99')).toBe(99.99);
            expect(FinancialDataHandler.validateAmount('$100')).toBe(100);
            expect(FinancialDataHandler.validateAmount('€99.99')).toBe(99.99);
        });
    });

    describe('validatePricing', () => {
        it('should validate complete pricing objects', () => {
            const result = FinancialDataHandler.validatePricing({
                amount: 100,
                currency: 'USD'
            });

            expect(result.amount).toBe(100);
            expect(result.currency).toBe('USD');
            expect(result.formatted).toBe('$100.00');
        });

        it('should handle invalid pricing objects', () => {
            const result = FinancialDataHandler.validatePricing(null);

            expect(result.amount).toBe(null);
            expect(result.currency).toBe('USD');
            expect(result.formatted).toBe('Price not set');
        });

        it('should use default currency when missing', () => {
            const result = FinancialDataHandler.validatePricing({
                amount: 100
            });

            expect(result.currency).toBe('USD');
            expect(result.formatted).toBe('$100.00');
        });
    });

    describe('isValidForCalculation', () => {
        it('should return true for valid positive numbers', () => {
            expect(FinancialDataHandler.isValidForCalculation(100)).toBe(true);
            expect(FinancialDataHandler.isValidForCalculation(0)).toBe(true);
            expect(FinancialDataHandler.isValidForCalculation('100')).toBe(true);
        });

        it('should return false for invalid or negative numbers', () => {
            expect(FinancialDataHandler.isValidForCalculation(null)).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation(undefined)).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation(NaN)).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation(-100)).toBe(false);
        });
    });

    describe('safe arithmetic operations', () => {
        it('should safely add valid numbers', () => {
            expect(FinancialDataHandler.safeAdd(100, 50)).toBe(150);
            expect(FinancialDataHandler.safeAdd('100', '50')).toBe(150);
        });

        it('should return null for invalid inputs', () => {
            expect(FinancialDataHandler.safeAdd(100, null)).toBe(null);
            expect(FinancialDataHandler.safeAdd(null, 50)).toBe(null);
            expect(FinancialDataHandler.safeAdd(NaN, 50)).toBe(null);
        });

        it('should safely subtract valid numbers', () => {
            expect(FinancialDataHandler.safeSubtract(100, 50)).toBe(50);
            expect(FinancialDataHandler.safeSubtract('100', '50')).toBe(50);
        });

        it('should safely multiply valid numbers', () => {
            expect(FinancialDataHandler.safeMultiply(100, 2)).toBe(200);
            expect(FinancialDataHandler.safeMultiply('100', '2')).toBe(200);
        });
    });

    describe('compareAmounts', () => {
        it('should compare valid amounts', () => {
            expect(FinancialDataHandler.compareAmounts(100, 50)).toBe(1);
            expect(FinancialDataHandler.compareAmounts(50, 100)).toBe(-1);
            expect(FinancialDataHandler.compareAmounts(100, 100)).toBe(0);
        });

        it('should return null for invalid inputs', () => {
            expect(FinancialDataHandler.compareAmounts(100, null)).toBe(null);
            expect(FinancialDataHandler.compareAmounts(null, 100)).toBe(null);
        });
    });

    describe('formatPercentage', () => {
        it('should format valid percentages', () => {
            expect(FinancialDataHandler.formatPercentage(50)).toBe('50.0%');
            expect(FinancialDataHandler.formatPercentage(33.333, 2)).toBe('33.33%');
        });

        it('should handle invalid values', () => {
            expect(FinancialDataHandler.formatPercentage(null)).toBe('N/A');
            expect(FinancialDataHandler.formatPercentage(undefined)).toBe('N/A');
        });
    });

    describe('currency support', () => {
        it('should support multiple currencies', () => {
            expect(FinancialDataHandler.formatCurrency(100, 'EUR')).toBe('€100.00');
            expect(FinancialDataHandler.formatCurrency(100, 'GBP')).toBe('£100.00');
            expect(FinancialDataHandler.formatCurrency(1, 'BTC')).toBe('₿1.00000000');
        });

        it('should fall back to default currency for unsupported ones', () => {
            expect(FinancialDataHandler.formatCurrency(100, 'INVALID')).toBe('$100.00');
        });

        it('should check currency support', () => {
            expect(FinancialDataHandler.isSupportedCurrency('USD')).toBe(true);
            expect(FinancialDataHandler.isSupportedCurrency('EUR')).toBe(true);
            expect(FinancialDataHandler.isSupportedCurrency('INVALID')).toBe(false);
        });
    });

    describe('legacy compatibility', () => {
        it('should provide legacy formatCurrency function', () => {
            expect(FinancialDataHandler.legacyFormatCurrency(100)).toBe('$100.00');
            expect(FinancialDataHandler.legacyFormatCurrency(null as any)).toBe('Price not set');
        });
    });
});