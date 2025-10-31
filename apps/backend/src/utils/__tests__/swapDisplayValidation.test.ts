/**
 * Tests for Swap Display Validation Utilities
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Verify validation and sanitization functionality
 */

import { describe, it, expect } from 'vitest';
import {
    FinancialDataHandler,
    SwapDataValidator,
    DataConsistencyValidator,
    FallbackDataProvider,
    SwapDisplayValidationService
} from '../swapDisplayValidation';

describe('FinancialDataHandler', () => {
    it('should format currency correctly', () => {
        expect(FinancialDataHandler.formatCurrency(50, 'EUR')).toBe('€50.00');
        expect(FinancialDataHandler.formatCurrency(null)).toBe('Price not set');
        expect(FinancialDataHandler.formatCurrency(undefined)).toBe('Price not set');
        expect(FinancialDataHandler.formatCurrency('invalid')).toBe('Invalid price');
    });

    it('should validate amounts correctly', () => {
        expect(FinancialDataHandler.validateAmount(50)).toBe(50);
        expect(FinancialDataHandler.validateAmount('50')).toBe(50);
        expect(FinancialDataHandler.validateAmount(null)).toBe(null);
        expect(FinancialDataHandler.validateAmount('invalid')).toBe(null);
        expect(FinancialDataHandler.validateAmount(NaN)).toBe(null);
    });

    it('should validate pricing data', () => {
        const pricing = FinancialDataHandler.validatePricing({ amount: 50, currency: 'EUR' });
        expect(pricing.amount).toBe(50);
        expect(pricing.currency).toBe('EUR');
        expect(pricing.formatted).toBe('€50.00');

        const emptyPricing = FinancialDataHandler.validatePricing(null);
        expect(emptyPricing.amount).toBe(null);
        expect(emptyPricing.formatted).toBe('Price not set');
    });
});

describe('SwapDataValidator', () => {
    it('should validate and sanitize swap data', () => {
        const rawSwapData = {
            id: 'swap-123',
            title: 'Test Swap',
            description: 'Test description',
            ownerId: 'user-123',
            ownerName: 'Test User',
            status: 'active',
            pricing: { amount: 50, currency: 'EUR' }
        };

        const result = SwapDataValidator.validateAndSanitize(rawSwapData);

        expect(result.isValid).toBe(true);
        expect(result.sanitizedData).toBeTruthy();
        expect(result.sanitizedData?.id).toBe('swap-123');
        expect(result.sanitizedData?.pricing.formatted).toBe('€50.00');
    });

    it('should handle invalid swap data', () => {
        const result = SwapDataValidator.validateAndSanitize(null);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Swap data is null or undefined');
        expect(result.sanitizedData).toBe(null);
    });

    it('should validate batch data', () => {
        const rawSwapDataArray = [
            { id: 'swap-1', title: 'Swap 1', ownerId: 'user-1', ownerName: 'User 1' },
            { id: 'swap-2', title: 'Swap 2', ownerId: 'user-2', ownerName: 'User 2' },
            null // Invalid data
        ];

        const result = SwapDataValidator.validateBatch(rawSwapDataArray);

        expect(result.summary.total).toBe(3);
        expect(result.summary.valid).toBe(2);
        expect(result.summary.invalid).toBe(1);
        expect(result.validSwaps).toHaveLength(2);
    });
});

describe('FallbackDataProvider', () => {
    it('should provide empty swap data', () => {
        const fallbackData = FallbackDataProvider.getEmptySwapData('test-swap');

        expect(fallbackData.id).toBe('test-swap');
        expect(fallbackData.title).toBe('Swap data unavailable');
        expect(fallbackData.pricing.formatted).toBe('Price not available');
        expect(fallbackData.targeting.totalIncomingCount).toBe(0);
    });

    it('should provide contextual fallback', () => {
        const networkError = new Error('Network timeout');
        const fallbackData = FallbackDataProvider.getContextualFallback(networkError, 'test-swap');

        expect(fallbackData.title).toBe('Network error - data temporarily unavailable');
        expect(fallbackData.description).toBe('Please check your connection and try again');
    });

    it('should repair partial swap data', () => {
        const partialData = {
            id: 'swap-123',
            title: 'Test Swap'
            // Missing other fields
        };

        const repairedData = FallbackDataProvider.repairSwapData(partialData, 'swap-123');

        expect(repairedData.id).toBe('swap-123');
        expect(repairedData.title).toBe('Test Swap');
        expect(repairedData.ownerName).toBe('Unknown User'); // Fallback value
        expect(repairedData.pricing.formatted).toBe('Price not available'); // Fallback value
    });
});

describe('DataConsistencyValidator', () => {
    it('should validate swap consistency', () => {
        const validSwapData = {
            id: 'swap-123',
            title: 'Test Swap',
            description: 'Test description',
            ownerId: 'user-123',
            ownerName: 'Test User',
            status: 'active',
            pricing: {
                amount: 50,
                currency: 'EUR',
                formatted: '€50.00'
            },
            targeting: {
                incomingProposals: [],
                outgoingTarget: null,
                totalIncomingCount: 0
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const report = DataConsistencyValidator.validateSwapConsistency(validSwapData);

        expect(report.swapId).toBe('swap-123');
        expect(report.isConsistent).toBe(true);
        expect(report.summary.errorCount).toBe(0);
    });

    it('should detect consistency issues', () => {
        const inconsistentSwapData = {
            id: 'swap-123',
            title: '',  // Missing title
            description: '',
            ownerId: '',  // Missing owner ID
            ownerName: 'Unknown User',
            status: 'invalid-status',  // Invalid status
            pricing: {
                amount: 50,
                currency: 'EUR',
                formatted: 'Price not set'  // Inconsistent with amount
            },
            targeting: {
                incomingProposals: [],
                outgoingTarget: null,
                totalIncomingCount: 5  // Inconsistent count
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const report = DataConsistencyValidator.validateSwapConsistency(inconsistentSwapData);

        expect(report.isConsistent).toBe(false);
        expect(report.summary.errorCount).toBeGreaterThan(0);
        expect(report.issues.length).toBeGreaterThan(0);
    });
});

describe('SwapDisplayValidationService', () => {
    it('should perform complete validation pipeline', async () => {
        const rawSwapData = {
            id: 'swap-123',
            title: 'Test Swap',
            description: 'Test description',
            ownerId: 'user-123',
            ownerName: 'Test User',
            status: 'active',
            pricing: { amount: 50, currency: 'EUR' }
        };

        const result = await SwapDisplayValidationService.validateCompleteSwapData(rawSwapData);

        expect(result.validatedData).toBeTruthy();
        expect(result.consistencyReport).toBeTruthy();
        expect(result.summary.validationPassed).toBe(true);
        expect(result.summary.consistencyPassed).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
        const result = await SwapDisplayValidationService.validateCompleteSwapData(null);

        expect(result.validatedData).toBeTruthy(); // Should provide fallback
        expect(result.hasErrors).toBe(true);
        expect(result.summary.validationPassed).toBe(false);
        expect(result.summary.recommendations.length).toBeGreaterThan(0);
    });

    it('should validate batch data', async () => {
        const rawSwapDataArray = [
            { id: 'swap-1', title: 'Swap 1', ownerId: 'user-1', ownerName: 'User 1' },
            { id: 'swap-2', title: 'Swap 2', ownerId: 'user-2', ownerName: 'User 2' }
        ];

        const result = await SwapDisplayValidationService.validateBatchSwapData(rawSwapDataArray);

        expect(result.validatedSwaps).toHaveLength(2);
        expect(result.summary.totalProcessed).toBe(2);
        expect(result.summary.validationPassed).toBe(2);
        expect(result.summary.validationFailed).toBe(0);
    });
});