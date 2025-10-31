/**
 * Unit Tests for Financial Data Handler
 * Requirements: 4.1, 4.2, 4.3 - Financial data validation and sanitization
 */

import { describe, it, expect } from 'vitest';
import { FinancialDataHandler } from '../../../apps/backend/src/utils/financialDataHandler';

describe('FinancialDataHandler', () => {
    describe('formatCurrency', () => {
        it('should format valid amounts correctly', () => {
            expect(FinancialDataHandler.formatCurrency(50, 'EUR')).toBe('€50.00');
            expect(FinancialDataHandler.formatCurrency(100.5, 'USD')).toBe('$100.50');
            expect(FinancialDataHandler.formatCurrency(0, 'GBP')).toBe('£0.00');
        });

        it('should handle null and undefined values', () => {
            expect(FinancialDataHandler.formatCurrency(null)).toBe('Price not set');
            expect(FinancialDataHandler.formatCurrency(undefined)).toBe('Price not set');
            expect(FinancialDataHandler.formatCurrency('')).toBe('Price not set');
        });

        it('should handle invalid values', () => {
            expect(FinancialDataHandler.formatCurrency('invalid')).toBe('Invalid price');
            expect(FinancialDataHandler.formatCurrency(NaN)).toBe('Invalid price');
            expect(FinancialDataHandler.formatCurrency(Infinity)).toBe('Invalid price');
        });

        it('should use default currency when not specified', () => {
            expect(FinancialDataHandler.formatCurrency(25)).toBe('€25.00');
        });

        it('should handle string amounts with currency symbols', () => {
            expect(FinancialDataHandler.formatCurrency('€50.00', 'EUR')).toBe('€50.00');
            expect(FinancialDataHandler.formatCurrency('$100', 'USD')).toBe('$100.00');
        });
    });

    describe('validateAmount', () => {
        it('should validate numeric amounts correctly', () => {
            expect(FinancialDataHandler.validateAmount(50)).toBe(50);
            expect(FinancialDataHandler.validateAmount(0)).toBe(0);
            expect(FinancialDataHandler.validateAmount(100.5)).toBe(100.5);
        });

        it('should return null for invalid amounts', () => {
            expect(FinancialDataHandler.validateAmount(null)).toBe(null);
            expect(FinancialDataHandler.validateAmount(undefined)).toBe(null);
            expect(FinancialDataHandler.validateAmount('')).toBe(null);
            expect(FinancialDataHandler.validateAmount('invalid')).toBe(null);
            expect(FinancialDataHandler.validateAmount(NaN)).toBe(null);
            expect(FinancialDataHandler.validateAmount(Infinity)).toBe(null);
        });

        it('should parse string amounts correctly', () => {
            expect(FinancialDataHandler.validateAmount('50')).toBe(50);
            expect(FinancialDataHandler.validateAmount('100.50')).toBe(100.5);
            expect(FinancialDataHandler.validateAmount('€50.00')).toBe(50);
            expect(FinancialDataHandler.validateAmount('$100')).toBe(100);
        });

        it('should handle edge cases', () => {
            expect(FinancialDataHandler.validateAmount('   ')).toBe(null);
            expect(FinancialDataHandler.validateAmount('€')).toBe(null);
            expect(FinancialDataHandler.validateAmount('$')).toBe(null);
        });
    });

    describe('validatePricing', () => {
        it('should validate complete pricing objects', () => {
            const pricing = { amount: 50, currency: 'EUR' };
            const result = FinancialDataHandler.validatePricing(pricing);

            expect(result.amount).toBe(50);
            expect(result.currency).toBe('EUR');
            expect(result.formatted).toBe('€50.00');
        });

        it('should handle null pricing data', () => {
            const result = FinancialDataHandler.validatePricing(null);

            expect(result.amount).toBe(null);
            expect(result.currency).toBe('EUR');
            expect(result.formatted).toBe('Price not set');
        });

        it('should handle invalid pricing data', () => {
            const pricing = { amount: 'invalid', currency: 'EUR' };
            const result = FinancialDataHandler.validatePricing(pricing);

            expect(result.amount).toBe(null);
            expect(result.currency).toBe('EUR');
            expect(result.formatted).toBe('Invalid price');
        });

        it('should use default currency when not provided', () => {
            const pricing = { amount: 50 };
            const result = FinancialDataHandler.validatePricing(pricing);

            expect(result.currency).toBe('EUR');
            expect(result.formatted).toBe('€50.00');
        });
    });

    describe('safe arithmetic operations', () => {
        describe('safeAdd', () => {
            it('should add valid amounts', () => {
                expect(FinancialDataHandler.safeAdd(10, 20)).toBe(30);
                expect(FinancialDataHandler.safeAdd(0, 5)).toBe(5);
                expect(FinancialDataHandler.safeAdd(-5, 10)).toBe(5);
            });

            it('should return null for invalid amounts', () => {
                expect(FinancialDataHandler.safeAdd(null, 20)).toBe(null);
                expect(FinancialDataHandler.safeAdd(10, undefined)).toBe(null);
                expect(FinancialDataHandler.safeAdd('invalid', 20)).toBe(null);
            });
        });

        describe('safeSubtract', () => {
            it('should subtract valid amounts', () => {
                expect(FinancialDataHandler.safeSubtract(20, 10)).toBe(10);
                expect(FinancialDataHandler.safeSubtract(5, 0)).toBe(5);
                expect(FinancialDataHandler.safeSubtract(10, 15)).toBe(-5);
            });

            it('should return null for invalid amounts', () => {
                expect(FinancialDataHandler.safeSubtract(null, 10)).toBe(null);
                expect(FinancialDataHandler.safeSubtract(20, undefined)).toBe(null);
            });
        });

        describe('safeMultiply', () => {
            it('should multiply valid amounts', () => {
                expect(FinancialDataHandler.safeMultiply(10, 2)).toBe(20);
                expect(FinancialDataHandler.safeMultiply(5, 0)).toBe(0);
                expect(FinancialDataHandler.safeMultiply(-5, 2)).toBe(-10);
            });

            it('should return null for invalid amounts', () => {
                expect(FinancialDataHandler.safeMultiply(null, 2)).toBe(null);
                expect(FinancialDataHandler.safeMultiply(10, 'invalid')).toBe(null);
            });
        });
    });

    describe('isValidForCalculation', () => {
        it('should return true for valid amounts', () => {
            expect(FinancialDataHandler.isValidForCalculation(50)).toBe(true);
            expect(FinancialDataHandler.isValidForCalculation(0)).toBe(true);
            expect(FinancialDataHandler.isValidForCalculation('100')).toBe(true);
        });

        it('should return false for invalid amounts', () => {
            expect(FinancialDataHandler.isValidForCalculation(null)).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation(undefined)).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation('invalid')).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation(-5)).toBe(false);
        });
    });

    describe('compareAmounts', () => {
        it('should compare valid amounts correctly', () => {
            expect(FinancialDataHandler.compareAmounts(10, 5)).toBe(1);
            expect(FinancialDataHandler.compareAmounts(5, 10)).toBe(-1);
            expect(FinancialDataHandler.compareAmounts(10, 10)).toBe(0);
        });

        it('should return null for invalid amounts', () => {
            expect(FinancialDataHandler.compareAmounts(null, 10)).toBe(null);
            expect(FinancialDataHandler.compareAmounts(10, undefined)).toBe(null);
        });
    });

    describe('formatPercentage', () => {
        it('should format valid percentages', () => {
            expect(FinancialDataHandler.formatPercentage(50)).toBe('50.0%');
            expect(FinancialDataHandler.formatPercentage(33.333, 2)).toBe('33.33%');
            expect(FinancialDataHandler.formatPercentage(0)).toBe('0.0%');
        });

        it('should handle invalid values', () => {
            expect(FinancialDataHandler.formatPercentage(null)).toBe('N/A');
            expect(FinancialDataHandler.formatPercentage(undefined)).toBe('N/A');
            expect(FinancialDataHandler.formatPercentage('invalid')).toBe('N/A');
        });
    });

    describe('currency support', () => {
        it('should support all defined currencies', () => {
            const currencies = FinancialDataHandler.getSupportedCurrencies();
            expect(currencies.length).toBeGreaterThan(0);

            currencies.forEach(currency => {
                expect(currency.symbol).toBeDefined();
                expect(currency.code).toBeDefined();
                expect(currency.decimals).toBeDefined();
            });
        });

        it('should check currency support correctly', () => {
            expect(FinancialDataHandler.isSupportedCurrency('EUR')).toBe(true);
            expect(FinancialDataHandler.isSupportedCurrency('USD')).toBe(true);
            expect(FinancialDataHandler.isSupportedCurrency('INVALID')).toBe(false);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle very large numbers', () => {
            const largeNumber = 999999999.99;
            expect(FinancialDataHandler.formatCurrency(largeNumber)).toBe('€999999999.99');
            expect(FinancialDataHandler.validateAmount(largeNumber)).toBe(largeNumber);
        });

        it('should handle very small numbers', () => {
            const smallNumber = 0.01;
            expect(FinancialDataHandler.formatCurrency(smallNumber)).toBe('€0.01');
            expect(FinancialDataHandler.validateAmount(smallNumber)).toBe(smallNumber);
        });

        it('should handle scientific notation', () => {
            expect(FinancialDataHandler.validateAmount('1e2')).toBe(100);
            expect(FinancialDataHandler.formatCurrency('1e2')).toBe('€100.00');
        });

        it('should handle different number formats', () => {
            expect(FinancialDataHandler.validateAmount('1,000.50')).toBe(1000.50);
            expect(FinancialDataHandler.formatCurrency('1,000.50')).toBe('€1000.50');
        });
    });
});