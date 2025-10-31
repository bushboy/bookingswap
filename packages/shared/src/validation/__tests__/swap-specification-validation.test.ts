import { describe, it, expect } from 'vitest';
import {
  validateSwapSpecificationData,
  validateSwapSpecificationUpdateData,
  validateCreateSwapSpecificationRequest,
  isValidSwapSpecificationData,
  isValidAcceptanceStrategy,
  hasSwapSpecificationErrors,
  getSwapSpecificationErrorSummary,
  sanitizeSwapSpecificationData,
  validateCashAmountConsistency,
  validateWalletRequirements,
} from '../swap-specification-validation';
import { SwapSpecificationData, CreateSwapSpecificationRequest } from '../../types/swap-specification';

describe('swap-specification-validation', () => {
  const validSwapData: SwapSpecificationData = {
    bookingId: 'booking-123',
    paymentTypes: ['booking', 'cash'],
    minCashAmount: 100,
    maxCashAmount: 500,
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    swapConditions: ['No smoking', 'Pet-friendly'],
    swapEnabled: true,
  };

  describe('validateSwapSpecificationData', () => {
    it('should validate complete swap specification without errors', () => {
      const errors = validateSwapSpecificationData(validSwapData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should require booking ID', () => {
      const data = { ...validSwapData, bookingId: '' };
      const errors = validateSwapSpecificationData(data);
      expect(errors.bookingId).toBeDefined();
      expect(errors.bookingId).toContain('required');
    });

    it('should require at least one payment type', () => {
      const data = { ...validSwapData, paymentTypes: [] };
      const errors = validateSwapSpecificationData(data);
      expect(errors.paymentTypes).toBeDefined();
      expect(errors.paymentTypes).toContain('At least one payment type');
    });

    it('should validate payment type values', () => {
      const data = { ...validSwapData, paymentTypes: ['invalid'] as any };
      const errors = validateSwapSpecificationData(data);
      expect(errors.paymentTypes).toBeDefined();
      expect(errors.paymentTypes).toContain('Invalid payment types');
    });

    it('should validate cash amounts when cash is enabled', () => {
      const data = { ...validSwapData, minCashAmount: 0 };
      const errors = validateSwapSpecificationData(data);
      expect(errors.minCashAmount).toBeDefined();
      expect(errors.minCashAmount).toContain('greater than 0');
    });

    it('should validate cash amount relationship', () => {
      const data = { ...validSwapData, minCashAmount: 500, maxCashAmount: 100 };
      const errors = validateSwapSpecificationData(data);
      expect(errors.maxCashAmount).toBeDefined();
      expect(errors.maxCashAmount).toContain('greater than or equal to minimum');
    });

    it('should require valid acceptance strategy', () => {
      const data = { ...validSwapData, acceptanceStrategy: 'invalid' as any };
      const errors = validateSwapSpecificationData(data);
      expect(errors.acceptanceStrategy).toBeDefined();
      expect(errors.acceptanceStrategy).toContain('Valid acceptance strategy');
    });

    it('should require auction end date for auction strategy', () => {
      const data = { ...validSwapData, acceptanceStrategy: 'auction' as const, auctionEndDate: undefined };
      const errors = validateSwapSpecificationData(data);
      expect(errors.auctionEndDate).toBeDefined();
      expect(errors.auctionEndDate).toContain('required for auction strategy');
    });

    it('should require future auction end date', () => {
      const data = {
        ...validSwapData,
        acceptanceStrategy: 'auction' as const,
        auctionEndDate: new Date('2020-01-01'),
      };
      const errors = validateSwapSpecificationData(data);
      expect(errors.auctionEndDate).toBeDefined();
      expect(errors.auctionEndDate).toContain('future');
    });

    it('should limit auction end date to 30 days', () => {
      const data = {
        ...validSwapData,
        acceptanceStrategy: 'auction' as const,
        auctionEndDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days from now
      };
      const errors = validateSwapSpecificationData(data);
      expect(errors.auctionEndDate).toBeDefined();
      expect(errors.auctionEndDate).toContain('30 days');
    });

    it('should require swap conditions', () => {
      const data = { ...validSwapData, swapConditions: [] };
      const errors = validateSwapSpecificationData(data);
      expect(errors.swapConditions).toBeDefined();
      expect(errors.swapConditions).toContain('At least one swap condition');
    });

    it('should validate non-empty swap conditions', () => {
      const data = { ...validSwapData, swapConditions: ['Valid condition', ''] };
      const errors = validateSwapSpecificationData(data);
      expect(errors.swapConditions).toBeDefined();
      expect(errors.swapConditions).toContain('non-empty');
    });
  });

  describe('validateSwapSpecificationUpdateData', () => {
    it('should validate partial update data', () => {
      const updateData = {
        paymentTypes: ['booking'] as const,
        minCashAmount: 200,
      };
      const errors = validateSwapSpecificationUpdateData(updateData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should validate only provided fields', () => {
      const updateData = {
        paymentTypes: [] as any, // Invalid
        minCashAmount: 200, // Valid
      };
      const errors = validateSwapSpecificationUpdateData(updateData);
      expect(errors.paymentTypes).toBeDefined();
      expect(errors.minCashAmount).toBeUndefined();
    });
  });

  describe('validateCreateSwapSpecificationRequest', () => {
    it('should validate create request', () => {
      const createRequest: CreateSwapSpecificationRequest = {
        ...validSwapData,
        walletAddress: '0x123...',
      };
      const errors = validateCreateSwapSpecificationRequest(createRequest);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateCashAmountConsistency', () => {
    it('should validate cash amounts are not set when cash is disabled', () => {
      const data = {
        ...validSwapData,
        paymentTypes: ['booking'] as const,
        minCashAmount: 100,
      };
      const errors = validateCashAmountConsistency(data);
      expect(errors.minCashAmount).toBeDefined();
      expect(errors.minCashAmount).toContain('should not be set when cash payments are disabled');
    });

    it('should validate auction end date is not set for non-auction strategy', () => {
      const data = {
        ...validSwapData,
        acceptanceStrategy: 'first_match' as const,
        auctionEndDate: new Date(),
      };
      const errors = validateCashAmountConsistency(data);
      expect(errors.auctionEndDate).toBeDefined();
      expect(errors.auctionEndDate).toContain('should not be set when auction strategy is not selected');
    });
  });

  describe('validateWalletRequirements', () => {
    it('should require wallet connection when swap is enabled', () => {
      const errors = validateWalletRequirements(validSwapData, false);
      expect(errors.walletConnection).toBeDefined();
      expect(errors.walletConnection).toContain('Wallet connection is required');
    });

    it('should pass when wallet is connected', () => {
      const errors = validateWalletRequirements(validSwapData, true);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('type guards', () => {
    it('should identify valid swap specification data', () => {
      expect(isValidSwapSpecificationData(validSwapData)).toBe(true);
      expect(isValidSwapSpecificationData({})).toBe(false);
      expect(isValidSwapSpecificationData(null)).toBe(false);
    });

    it('should identify valid acceptance strategies', () => {
      expect(isValidAcceptanceStrategy('first_match')).toBe(true);
      expect(isValidAcceptanceStrategy('auction')).toBe(true);
      expect(isValidAcceptanceStrategy('invalid')).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should detect validation errors', () => {
      expect(hasSwapSpecificationErrors({})).toBe(false);
      expect(hasSwapSpecificationErrors({ paymentTypes: 'Error message' })).toBe(true);
    });

    it('should generate error summary', () => {
      const errors = { paymentTypes: 'Payment error', acceptanceStrategy: 'Strategy error' };
      const summary = getSwapSpecificationErrorSummary(errors);
      expect(summary).toHaveLength(2);
      expect(summary).toContain('Payment error');
      expect(summary).toContain('Strategy error');
    });

    it('should sanitize swap specification data', () => {
      const dirtyData = {
        ...validSwapData,
        bookingId: '  booking-123  ',
        swapConditions: ['  Condition 1  ', '  Condition 2  ', ''],
      };
      const sanitized = sanitizeSwapSpecificationData(dirtyData);
      expect(sanitized.bookingId).toBe('booking-123');
      expect(sanitized.swapConditions).toHaveLength(2);
      expect(sanitized.swapConditions[0]).toBe('Condition 1');
      expect(sanitized.swapConditions[1]).toBe('Condition 2');
    });
  });
});