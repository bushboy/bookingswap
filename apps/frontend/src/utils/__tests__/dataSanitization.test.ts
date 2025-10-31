/**
 * Tests for data sanitization utilities
 * 
 * These tests verify that the sanitization functions properly remove
 * auction and cash swap properties when features are disabled.
 */

import { describe, it, expect } from 'vitest';
import {
    sanitizeCreateSwapRequest,
    sanitizeCreateProposalRequest,
    sanitizeSwapData,
    sanitizeProposalData,
    validateCreateSwapRequestCompliance,
    validateCreateProposalRequestCompliance,
    hasAuctionProperties,
    hasCashProperties,
    hasProposalCashProperties,
    filterCashProposals,
    filterAuctionSwaps,
    filterCashSwaps,
    EnhancedCreateSwapRequest,
    CreateProposalRequest,
    SwapDisplayData,
    ProposalDisplayData,
} from '../dataSanitization';

// Mock feature flags for testing
import { vi } from 'vitest';

vi.mock('@/config/featureFlags', () => ({
    FEATURE_FLAGS: {
        ENABLE_AUCTION_MODE: false,
        ENABLE_CASH_SWAPS: false,
        ENABLE_CASH_PROPOSALS: false,
    },
}));

describe('Data Sanitization Utilities', () => {
    describe('sanitizeCreateSwapRequest', () => {
        it('should remove auction properties when auction mode is disabled', () => {
            const request: EnhancedCreateSwapRequest = {
                sourceBookingId: 'booking-123',
                title: 'Test Swap',
                description: 'Test Description',
                paymentTypes: {
                    bookingExchange: true,
                    cashPayment: false,
                },
                acceptanceStrategy: {
                    type: 'auction',
                    auctionEndDate: new Date(),
                    autoSelectHighest: true,
                },
                auctionSettings: {
                    endDate: new Date(),
                    allowBookingProposals: true,
                    allowCashProposals: true,
                    minimumCashOffer: 100,
                    autoSelectAfterHours: 24,
                },
                swapPreferences: {
                    preferredLocations: ['New York'],
                },
                expirationDate: new Date(),
            };

            const sanitized = sanitizeCreateSwapRequest(request);

            expect(sanitized.acceptanceStrategy.type).toBe('first_match');
            expect(sanitized.acceptanceStrategy.auctionEndDate).toBeUndefined();
            expect(sanitized.acceptanceStrategy.autoSelectHighest).toBeUndefined();
            expect(sanitized.auctionSettings).toBeUndefined();
        });

        it('should remove cash properties when cash swaps are disabled', () => {
            const request: EnhancedCreateSwapRequest = {
                sourceBookingId: 'booking-123',
                title: 'Test Swap',
                description: 'Test Description',
                paymentTypes: {
                    bookingExchange: true,
                    cashPayment: true,
                    minimumCashAmount: 50,
                    preferredCashAmount: 100,
                },
                acceptanceStrategy: {
                    type: 'first_match',
                },
                swapPreferences: {
                    preferredLocations: ['New York'],
                },
                expirationDate: new Date(),
            };

            const sanitized = sanitizeCreateSwapRequest(request);

            expect(sanitized.paymentTypes.cashPayment).toBe(false);
            expect(sanitized.paymentTypes.minimumCashAmount).toBeUndefined();
            expect(sanitized.paymentTypes.preferredCashAmount).toBeUndefined();
        });
    });

    describe('sanitizeCreateProposalRequest', () => {
        it('should remove cash offer when cash proposals are disabled', () => {
            const request: CreateProposalRequest = {
                sourceSwapId: 'swap-123',
                conditions: ['Test condition'],
                agreedToTerms: true,
                cashOffer: {
                    amount: 100,
                    currency: 'USD',
                },
            };

            const sanitized = sanitizeCreateProposalRequest(request);

            expect(sanitized.cashOffer).toBeUndefined();
            expect(sanitized.sourceSwapId).toBe('swap-123');
            expect(sanitized.conditions).toEqual(['Test condition']);
        });
    });

    describe('sanitizeSwapData', () => {
        it('should remove auction and cash properties from swap display data', () => {
            const swapData: SwapDisplayData = {
                id: 'swap-123',
                sourceBookingId: 'booking-123',
                status: 'active',
                paymentTypes: {
                    bookingExchange: true,
                    cashPayment: true,
                    minimumCashAmount: 50,
                    preferredCashAmount: 100,
                },
                acceptanceStrategy: {
                    type: 'auction',
                    auctionEndDate: new Date(),
                    autoSelectHighest: true,
                },
                auctionId: 'auction-123',
                auctionSettings: {
                    endDate: new Date(),
                    allowBookingProposals: true,
                    allowCashProposals: true,
                    minimumCashOffer: 100,
                    autoSelectAfterHours: 24,
                },
                cashDetails: {
                    enabled: true,
                    minimumAmount: 50,
                    currency: 'USD',
                    escrowRequired: true,
                    platformFeePercentage: 5,
                },
            };

            const sanitized = sanitizeSwapData(swapData);

            expect(sanitized.auctionId).toBeUndefined();
            expect(sanitized.auctionSettings).toBeUndefined();
            expect(sanitized.cashDetails).toBeUndefined();
            expect(sanitized.acceptanceStrategy?.type).toBe('first_match');
            expect(sanitized.paymentTypes?.cashPayment).toBe(false);
            expect(sanitized.paymentTypes?.minimumCashAmount).toBeUndefined();
        });
    });

    describe('sanitizeProposalData', () => {
        it('should remove cash offer from proposal display data', () => {
            const proposalData: ProposalDisplayData = {
                id: 'proposal-123',
                proposalType: 'cash',
                cashOffer: {
                    amount: 100,
                    currency: 'USD',
                    paymentMethodId: 'pm-123',
                },
            };

            const sanitized = sanitizeProposalData(proposalData);

            expect(sanitized.cashOffer).toBeUndefined();
            expect(sanitized.proposalType).toBe('booking');
        });
    });

    describe('validation functions', () => {
        it('should detect auction properties in swap request', () => {
            const request: EnhancedCreateSwapRequest = {
                sourceBookingId: 'booking-123',
                title: 'Test',
                description: 'Test',
                paymentTypes: { bookingExchange: true, cashPayment: false },
                acceptanceStrategy: { type: 'auction' },
                swapPreferences: {},
                expirationDate: new Date(),
            };

            expect(hasAuctionProperties(request)).toBe(true);
        });

        it('should detect cash properties in swap request', () => {
            const request: EnhancedCreateSwapRequest = {
                sourceBookingId: 'booking-123',
                title: 'Test',
                description: 'Test',
                paymentTypes: { bookingExchange: true, cashPayment: true },
                acceptanceStrategy: { type: 'first_match' },
                swapPreferences: {},
                expirationDate: new Date(),
            };

            expect(hasCashProperties(request)).toBe(true);
        });

        it('should detect cash properties in proposal request', () => {
            const request: CreateProposalRequest = {
                conditions: [],
                agreedToTerms: true,
                cashOffer: { amount: 100, currency: 'USD' },
            };

            expect(hasProposalCashProperties(request)).toBe(true);
        });
    });

    describe('filtering functions', () => {
        it('should filter out cash proposals when feature is disabled', () => {
            const proposals: ProposalDisplayData[] = [
                { id: '1', proposalType: 'booking' },
                { id: '2', proposalType: 'cash' },
                { id: '3', proposalType: 'booking' },
            ];

            const filtered = filterCashProposals(proposals);

            expect(filtered).toHaveLength(2);
            expect(filtered.every(p => p.proposalType !== 'cash')).toBe(true);
        });

        it('should filter out auction swaps when feature is disabled', () => {
            const swaps: SwapDisplayData[] = [
                { id: '1', sourceBookingId: 'b1', status: 'active', acceptanceStrategy: { type: 'first_match' } },
                { id: '2', sourceBookingId: 'b2', status: 'active', acceptanceStrategy: { type: 'auction' } },
                { id: '3', sourceBookingId: 'b3', status: 'active' },
            ];

            const filtered = filterAuctionSwaps(swaps);

            expect(filtered).toHaveLength(2);
            expect(filtered.every(s => !s.acceptanceStrategy || s.acceptanceStrategy.type !== 'auction')).toBe(true);
        });

        it('should filter out cash swaps when feature is disabled', () => {
            const swaps: SwapDisplayData[] = [
                { id: '1', sourceBookingId: 'b1', status: 'active', paymentTypes: { bookingExchange: true, cashPayment: false } },
                { id: '2', sourceBookingId: 'b2', status: 'active', paymentTypes: { bookingExchange: true, cashPayment: true } },
                { id: '3', sourceBookingId: 'b3', status: 'active' },
            ];

            const filtered = filterCashSwaps(swaps);

            expect(filtered).toHaveLength(2);
            expect(filtered.every(s => !s.paymentTypes || !s.paymentTypes.cashPayment)).toBe(true);
        });
    });

    describe('compliance validation', () => {
        it('should return errors for non-compliant swap request', () => {
            const request: EnhancedCreateSwapRequest = {
                sourceBookingId: 'booking-123',
                title: 'Test',
                description: 'Test',
                paymentTypes: { bookingExchange: true, cashPayment: true },
                acceptanceStrategy: { type: 'auction' },
                swapPreferences: {},
                expirationDate: new Date(),
            };

            const errors = validateCreateSwapRequestCompliance(request);

            expect(errors).toContain('Auction mode is currently disabled');
            expect(errors).toContain('Cash payments are currently disabled');
        });

        it('should return errors for non-compliant proposal request', () => {
            const request: CreateProposalRequest = {
                conditions: [],
                agreedToTerms: true,
                cashOffer: { amount: 100, currency: 'USD' },
            };

            const errors = validateCreateProposalRequestCompliance(request);

            expect(errors).toContain('Cash offers are currently disabled');
        });
    });
});