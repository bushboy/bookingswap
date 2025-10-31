/**
 * Tests for error recovery utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getBookingEditRecoveryStrategy,
  getSwapSpecificationRecoveryStrategy,
  getBookingEditValidationGuidance,
  getSwapSpecificationValidationGuidance,
  createBookingEditRecoveryPlan,
  createSwapSpecificationRecoveryPlan,
  isAutoRecoverableError,
  requiresImmediateAttention,
  getRetryDelay,
} from '../error-recovery';
import { BookingEditErrors } from '../../types/booking-edit';
import { SwapSpecificationErrors } from '../../types/swap-specification';

describe('Error Recovery', () => {
  describe('getBookingEditRecoveryStrategy', () => {
    it('should return validation strategy for validation errors', () => {
      const error = new Error('Validation failed');
      const validationErrors: BookingEditErrors = {
        title: 'Title is required',
      };

      const strategy = getBookingEditRecoveryStrategy(error, validationErrors);

      expect(strategy.strategy).toBe('fix_and_retry');
      expect(strategy.title).toBe('Fix Booking Information');
      expect(strategy.requiresUserAction).toBe(true);
    });

    it('should return network strategy for network errors', () => {
      const error = new Error('Network connection failed');

      const strategy = getBookingEditRecoveryStrategy(error);

      expect(strategy.strategy).toBe('check_connection');
      expect(strategy.title).toBe('Connection Issue');
      expect(strategy.canAutoRecover).toBe(true);
    });

    it('should return authentication strategy for auth errors', () => {
      const error = new Error('Unauthorized access');

      const strategy = getBookingEditRecoveryStrategy(error);

      expect(strategy.strategy).toBe('login_required');
      expect(strategy.title).toBe('Login Required');
      expect(strategy.requiresUserAction).toBe(true);
    });

    it('should return server error strategy for server errors', () => {
      const error = new Error('Internal server error 500');

      const strategy = getBookingEditRecoveryStrategy(error);

      expect(strategy.strategy).toBe('retry');
      expect(strategy.title).toBe('Server Error');
      expect(strategy.canAutoRecover).toBe(true);
    });

    it('should return unknown strategy for unrecognized errors', () => {
      const error = new Error('Something weird happened');

      const strategy = getBookingEditRecoveryStrategy(error);

      expect(strategy.strategy).toBe('navigate_back');
      expect(strategy.title).toBe('Unexpected Error');
    });
  });

  describe('getSwapSpecificationRecoveryStrategy', () => {
    it('should return validation strategy for validation errors', () => {
      const error = new Error('Validation failed');
      const validationErrors: SwapSpecificationErrors = {
        paymentTypes: 'At least one payment type is required',
      };

      const strategy = getSwapSpecificationRecoveryStrategy(error, validationErrors);

      expect(strategy.strategy).toBe('fix_and_retry');
      expect(strategy.title).toBe('Fix Swap Settings');
    });

    it('should return wallet strategy for wallet errors', () => {
      const error = new Error('Wallet connection lost');

      const strategy = getSwapSpecificationRecoveryStrategy(error);

      expect(strategy.strategy).toBe('reconnect_wallet');
      expect(strategy.title).toBe('Wallet Connection Issue');
    });

    it('should return blockchain strategy for blockchain errors', () => {
      const error = new Error('Blockchain transaction failed');

      const strategy = getSwapSpecificationRecoveryStrategy(error);

      expect(strategy.strategy).toBe('retry');
      expect(strategy.title).toBe('Blockchain Transaction Failed');
    });

    it('should return insufficient funds strategy for balance errors', () => {
      const error = new Error('Insufficient funds for transaction');

      const strategy = getSwapSpecificationRecoveryStrategy(error);

      expect(strategy.strategy).toBe('contact_support');
      expect(strategy.title).toBe('Insufficient Funds');
    });
  });

  describe('getBookingEditValidationGuidance', () => {
    it('should provide specific guidance for each error type', () => {
      const errors: BookingEditErrors = {
        title: 'Title is required',
        description: 'Description is required',
        location: 'City is required',
        dateRange: 'Check-in date must be in the future',
        originalPrice: 'Original price must be greater than 0',
        providerDetails: 'Provider name is required',
      };

      const guidance = getBookingEditValidationGuidance(errors);

      expect(guidance).toContain('Make sure your booking has a clear, descriptive title');
      expect(guidance).toContain('Add a detailed description of your booking');
      expect(guidance).toContain('Verify that the city and country are correct');
      expect(guidance).toContain('Check that your check-in and check-out dates are valid and in the future');
      expect(guidance).toContain('Ensure all price values are positive numbers');
      expect(guidance).toContain('Complete all provider information including confirmation number');
    });

    it('should return empty array for no errors', () => {
      const errors: BookingEditErrors = {};

      const guidance = getBookingEditValidationGuidance(errors);

      expect(guidance).toHaveLength(0);
    });
  });

  describe('getSwapSpecificationValidationGuidance', () => {
    it('should provide specific guidance for each error type', () => {
      const errors: SwapSpecificationErrors = {
        paymentTypes: 'At least one payment type must be selected',
        minCashAmount: 'Minimum cash amount must be greater than 0',
        acceptanceStrategy: 'Valid acceptance strategy is required',
        auctionEndDate: 'Auction end date is required for auction strategy',
        swapConditions: 'At least one swap condition is required',
        walletConnection: 'Wallet connection is required to enable swapping',
      };

      const guidance = getSwapSpecificationValidationGuidance(errors);

      expect(guidance).toContain('Select at least one payment type (booking or cash)');
      expect(guidance).toContain('Set valid cash amount ranges if cash payments are enabled');
      expect(guidance).toContain('Choose how you want to accept swap proposals');
      expect(guidance).toContain('Set a valid auction end date if using auction strategy');
      expect(guidance).toContain('Add at least one condition for your swap');
      expect(guidance).toContain('Connect your wallet to enable swapping functionality');
    });
  });

  describe('isAutoRecoverableError', () => {
    it('should return true for network errors', () => {
      const error = new Error('Network timeout');
      expect(isAutoRecoverableError(error)).toBe(true);
    });

    it('should return true for temporary server errors', () => {
      const error = new Error('Server error 503');
      expect(isAutoRecoverableError(error)).toBe(true);
    });

    it('should return false for validation errors', () => {
      const error = new Error('Validation failed');
      expect(isAutoRecoverableError(error)).toBe(false);
    });

    it('should return false for authentication errors', () => {
      const error = new Error('Unauthorized');
      expect(isAutoRecoverableError(error)).toBe(false);
    });
  });

  describe('requiresImmediateAttention', () => {
    it('should return true for validation errors', () => {
      const error = new Error('Some error');
      const validationErrors: BookingEditErrors = { title: 'Required' };

      expect(requiresImmediateAttention(error, validationErrors)).toBe(true);
    });

    it('should return true for authentication errors', () => {
      const error = new Error('Unauthorized access');

      expect(requiresImmediateAttention(error)).toBe(true);
    });

    it('should return true for wallet errors', () => {
      const error = new Error('Wallet connection failed');

      expect(requiresImmediateAttention(error)).toBe(true);
    });

    it('should return false for network errors', () => {
      const error = new Error('Network timeout');

      expect(requiresImmediateAttention(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should implement exponential backoff', () => {
      expect(getRetryDelay(1)).toBe(1000);
      expect(getRetryDelay(2)).toBe(2000);
      expect(getRetryDelay(3)).toBe(4000);
      expect(getRetryDelay(4)).toBe(8000);
    });

    it('should cap at maximum delay', () => {
      expect(getRetryDelay(10)).toBe(30000); // Max 30 seconds
    });
  });

  describe('createBookingEditRecoveryPlan', () => {
    it('should create comprehensive recovery plan for validation errors', () => {
      const error = new Error('Validation failed');
      const validationErrors: BookingEditErrors = {
        title: 'Title is required',
      };

      const plan = createBookingEditRecoveryPlan(error, validationErrors);

      expect(plan.primaryStrategy.strategy).toBe('fix_and_retry');
      expect(plan.userGuidance.length).toBeGreaterThan(0);
      expect(plan.canAutoRecover).toBe(false);
      expect(plan.retryDelay).toBeUndefined();
      expect(plan.alternativeStrategies.length).toBeGreaterThan(0);
    });

    it('should create recovery plan for auto-recoverable errors', () => {
      const error = new Error('Network timeout');

      const plan = createBookingEditRecoveryPlan(error, undefined, 2);

      expect(plan.primaryStrategy.strategy).toBe('check_connection');
      expect(plan.canAutoRecover).toBe(true);
      expect(plan.retryDelay).toBe(2000); // Second attempt
    });
  });

  describe('createSwapSpecificationRecoveryPlan', () => {
    it('should create comprehensive recovery plan for wallet errors', () => {
      const error = new Error('Wallet disconnected');

      const plan = createSwapSpecificationRecoveryPlan(error);

      expect(plan.primaryStrategy.strategy).toBe('reconnect_wallet');
      expect(plan.canAutoRecover).toBe(false);
      expect(plan.alternativeStrategies.length).toBeGreaterThan(0);
    });

    it('should create recovery plan for blockchain errors', () => {
      const error = new Error('Transaction failed');

      const plan = createSwapSpecificationRecoveryPlan(error, undefined, 1);

      expect(plan.primaryStrategy.strategy).toBe('retry');
      expect(plan.canAutoRecover).toBe(true);
      expect(plan.retryDelay).toBe(1000);
    });
  });
});